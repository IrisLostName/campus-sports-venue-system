package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-04（docs/16 第 4.3 节）：真实线程 + CountDownLatch + 真实 PostgreSQL，经完整的 HTTP 栈并发提交。
 * 先来先得的最终保证是部分唯一索引 uq_reservation_active_slot（第 8 步只是前置检查）；同一用户的并发创建由用户行锁串行化（C4）。
 */
@DisplayName("ACC-M3-04 并发预约")
class ReservationConcurrencyTest extends ReservationApiTestBase {

    private static final int USERS = 10;
    private static final int SAME_USER_ATTEMPTS = 5;

    @Autowired
    private ReservationRepository reservations;

    /** 所有任务就绪后同时放行，返回每个请求的“状态码 + 错误码”。 */
    private List<String> runTogether(List<Callable<MvcResult>> tasks) throws Exception {
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            List<Future<MvcResult>> futures = new ArrayList<>();
            for (Callable<MvcResult> task : tasks) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    return task.call();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<String> outcomes = new ArrayList<>();
            for (Future<MvcResult> future : futures) {
                outcomes.add(outcome(future.get(60, TimeUnit.SECONDS)));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    private String outcome(MvcResult result) throws Exception {
        int status = result.getResponse().getStatus();
        return status == 201 ? "201" : status + " " + json(result).get("code").asText();
    }

    @Test
    @DisplayName("ACC-M3-04 10 个不同用户同时预约同一时段：恰好 1 个 201、9 个 SLOT_TAKEN、库中有效预约恰 1 条")
    void tenUsersRaceForOneSlot() throws Exception {
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (int i = 0; i < USERS; i++) {
            long userId = user("racer" + i, Role.USER);
            String authorization = userBearer(userId);
            tasks.add(() -> create(authorization, body(court1, TOMORROW, "09:30")));
        }

        List<String> outcomes = runTogether(tasks);

        assertThat(outcomes).filteredOn("201"::equals).hasSize(1);
        assertThat(outcomes).filteredOn(outcome -> !"201".equals(outcome)).hasSize(USERS - 1)
                .containsOnly("409 SLOT_TAKEN");
        assertThat(activeCount(court1, TOMORROW, "09:30")).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-04 C4：同一用户已持有 max−1 个，同时提交 5 个不同时段，恰好 1 个成功、其余 BOOKING_LIMIT_REACHED")
    void sameUserCannotExceedTheLimitConcurrently() throws Exception {
        fixtures.reservation(zhangsan, court2, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court2, TOMORROW, "09:30", "CONFIRMED");
        String authorization = userBearer(zhangsan);
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (String start : List.of("08:00", "09:30", "11:00", "12:30", "14:00")) {
            tasks.add(() -> create(authorization, body(court1, TOMORROW, start)));
        }

        List<String> outcomes = runTogether(tasks);

        assertThat(outcomes).filteredOn("201"::equals).hasSize(1);
        assertThat(outcomes).filteredOn(outcome -> !"201".equals(outcome)).hasSize(SAME_USER_ATTEMPTS - 1)
                .containsOnly("409 BOOKING_LIMIT_REACHED");
        assertThat(jdbc.queryForObject("select count(*) from reservation where user_id = ? and status = 'CONFIRMED'",
                Integer.class, zhangsan)).isEqualTo(3);
    }

    private Reservation draft(long userId, long resourceId, LocalDate date, String start) {
        Reservation reservation = new Reservation();
        reservation.setUserId(userId);
        reservation.setResourceId(resourceId);
        reservation.setServiceDate(date);
        reservation.setStartTime(LocalTime.parse(start));
        reservation.setEndTime(LocalTime.parse(start).plusMinutes(90));
        reservation.setStatus(ReservationStatus.CONFIRMED);
        reservation.setCreatedAt(LocalDateTime.of(TODAY, LocalTime.NOON));
        reservation.setUpdatedAt(LocalDateTime.of(TODAY, LocalTime.NOON));
        return reservation;
    }

    @Test
    @DisplayName("ACC-M3-04 只有 uq_reservation_active_slot 的 23505 才被识别为时段冲突")
    void onlyTheActiveSlotUniqueViolationIsRecognised() {
        reservations.saveAndFlush(draft(zhangsan, court1, TOMORROW, "09:30"));

        assertThatThrownBy(() -> reservations.saveAndFlush(draft(lisi, court1, TOMORROW, "09:30")))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class, ex -> {
                    assertThat(UniqueViolations.isViolationOf(ex, "uq_reservation_active_slot")).isTrue();
                    assertThat(UniqueViolations.isViolationOf(ex, "uq_venue_name")).isFalse();
                });
        // 外键错误（23503）不是唯一冲突，不得被识别为 SLOT_TAKEN
        assertThatThrownBy(() -> reservations.saveAndFlush(draft(999_999, court1, TOMORROW, "11:00")))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class, ex ->
                        assertThat(UniqueViolations.isViolationOf(ex, "uq_reservation_active_slot")).isFalse());
    }
}
