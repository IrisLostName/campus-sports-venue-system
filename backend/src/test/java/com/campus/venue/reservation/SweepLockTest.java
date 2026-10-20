package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.reservation.service.ReservationSweepService;
import com.campus.venue.reservation.service.ReservationSweepService.SweepResult;
import com.campus.venue.support.LockHolder;
import com.campus.venue.user.domain.Role;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * TEST-1 K1（BE-4 审计 N2）：清扫的候选行锁。签到不改 status，所以落库条件 status = 'CONFIRMED' 挡不住
 * “清扫读使用记录之后、更新之前提交的签到”；只有候选行锁能挡住。持锁方锁住预约并插入签到后停住，清扫在等锁
 * （pg_stat_activity 确认），持锁方提交后清扫必须看见签到而不置 NO_SHOW。去掉锁时清扫只在 UPDATE 处等待，
 * 放行后仍把它置为 NO_SHOW，本测试失败。时段为今天 09:30–11:00，未到场判定点 09:45:00。
 */
@DisplayName("ACC-M3-09 清扫与并发签到、并发清扫")
class SweepLockTest extends UsageApiTestBase {

    @Autowired
    private ReservationSweepService sweepService;

    @Autowired
    private DataSource dataSource;

    private LockHolder holder;
    private ExecutorService pool;

    @BeforeEach
    void openHolder() throws Exception {
        holder = LockHolder.open(dataSource, jdbc);
        pool = Executors.newFixedThreadPool(2);
    }

    @AfterEach
    void closeHolder() throws Exception {
        try {
            holder.close();
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("ACC-M3-09 K1 清扫等待预约行锁；持锁方插入签到并提交后，清扫看见签到，预约仍为 CONFIRMED、不置 NO_SHOW")
    void sweepWaitsForConcurrentCheckInAndLeavesItConfirmed() throws Exception {
        long id = todaySlot(zhangsan);
        holder.lockRow("reservation", id);
        holder.execute("insert into usage_record (reservation_id, check_in_at) values (?, ?)", id,
                Timestamp.valueOf(today(9, 44, 59)));
        clock.setLocal(today(9, 45, 1));

        Future<SweepResult> sweep = pool.submit(sweepService::sweep);
        holder.awaitBlocked(sweep);
        holder.commit();

        assertThat(sweep.get(60, TimeUnit.SECONDS)).isEqualTo(new SweepResult(0, 0));
        assertThat(status(id)).isEqualTo("CONFIRMED");
        assertThat(usageCount(id)).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-09 两次清扫同时运行：每条应落库的预约只被写一次，两次结果之和恰为应落库的条数")
    void twoSweepsTogetherSettleEachRowOnce() throws Exception {
        List<Long> noShow = new ArrayList<>();
        List<Long> completed = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            long user = user("sweep" + i, Role.USER);
            LocalDate day = TODAY.minusDays(1 + i);
            if (i % 3 == 0) {
                completed.add(checkedIn(user, court1, day, SLOT, day.atTime(9, 20)));
            } else {
                noShow.add(fixtures.reservation(user, court1, day, SLOT, "CONFIRMED"));
            }
        }
        clock.setLocal(today(9, 45, 1));

        CountDownLatch start = new CountDownLatch(1);
        Future<SweepResult> first = pool.submit(() -> {
            start.await();
            return sweepService.sweep();
        });
        Future<SweepResult> second = pool.submit(() -> {
            start.await();
            return sweepService.sweep();
        });
        start.countDown();
        SweepResult a = first.get(60, TimeUnit.SECONDS);
        SweepResult b = second.get(60, TimeUnit.SECONDS);

        assertThat(a.noShow() + b.noShow()).isEqualTo(noShow.size());
        assertThat(a.completed() + b.completed()).isEqualTo(completed.size());
        noShow.forEach(id -> assertThat(status(id)).isEqualTo("NO_SHOW"));
        completed.forEach(id -> assertThat(status(id)).isEqualTo("COMPLETED"));
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));
    }
}
