package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.support.LockHolder;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalTime;
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
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 K8 表征测试（BE-2b 第 7 节第 4 条、台账 S-060）：已知限制，不是期望行为。创建预约不锁场馆行，第 2–5 步读到的
 * “场地开放、时段不在关闭内”可能在插入提交之前被并发的管理变更推翻；管理变更的影响检查只看已提交的预约，看不到正在提交的那一条。
 * 确定性复现：持锁方在同一时段插入一条未提交的预约，使被测预约通过前置检查后停在唯一索引上（pg_stat_activity 确认）；
 * 此时新增覆盖该时段的关闭（CANCEL）并提交，受影响为 0；持锁方回滚后被测预约插入成功——一条有效预约落在关闭范围内。
 * 窗口只存在于预约请求“前置检查之后、提交之前”；管理员之后的任何预检（dryRun）都会把它列为受影响预约，可再处理。
 * 本包不改代码（裁决 K8），结论写入 ACC-M4-01 供论文“局限”使用。
 */
@DisplayName("TEST-1 K8 已知限制 S-060")
class ConcurrentBookingWindowTest extends ImpactApiTestBase {

    private static final String CLOSURES = "/api/v1/admin/venues/{id}/closures";

    @Autowired
    private DataSource dataSource;

    private LockHolder holder;
    private ExecutorService pool;

    @BeforeEach
    void openHolder() throws Exception {
        holder = LockHolder.open(dataSource, jdbc);
        pool = Executors.newSingleThreadExecutor();
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
    @DisplayName("TEST-1 K8 已知限制 S-060：关闭在预约提交之前完成时看不到它，预约随后提交成功、落在关闭范围内；之后的预检能发现它")
    void bookingInFlightDuringAClosureSurvivesItKnownLimitation() throws Exception {
        holder.execute("insert into reservation (user_id, resource_id, service_date, start_time, end_time, status)"
                + " values (?, ?, ?, ?, ?, 'CONFIRMED')", lisi, court1, TOMORROW, LocalTime.of(9, 30),
                LocalTime.of(11, 0));
        Future<MvcResult> booking = pool.submit(() -> send(HttpMethod.POST, "/api/v1/reservations",
                body("resourceId", court1, "serviceDate", TOMORROW.toString(), "startTime", "09:30"), zhangsan,
                Role.USER));
        holder.awaitBlocked(booking);

        MvcResult closure = asSys(HttpMethod.POST, CLOSURES, body("startDate", TOMORROW.toString(), "endDate",
                TOMORROW.toString(), "resourceId", court1, "onExistingReservations", "CANCEL", "reason", "赛事"),
                tennis);
        assertThat(closure.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(closure).get("impact").get("affectedCount").asInt()).isZero();
        assertThat(json(closure).get("cancelledIds")).isEmpty();
        holder.rollback();

        MvcResult created = booking.get(60, TimeUnit.SECONDS);
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        long survivor = json(created).get("id").asLong();
        assertThat(reservationStatus(survivor)).isEqualTo("CONFIRMED");

        JsonNode preview = json(asSys(HttpMethod.POST, CLOSURES, body("startDate", TOMORROW.toString(), "endDate",
                TOMORROW.toString(), "resourceId", court1, "dryRun", true), tennis));
        assertThat(briefIds(preview.get("impact"))).containsExactly(survivor);
    }
}
