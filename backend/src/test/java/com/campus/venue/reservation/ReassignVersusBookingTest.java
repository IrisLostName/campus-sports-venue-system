package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.LockHolder;
import java.time.LocalTime;
import java.util.Map;
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
 * TEST-1 并发（ACC-M3-04、ACC-M3-06）：资源改派与新预约争同一目标时段。改派的目标占用检查不加锁（读已提交），
 * 最终保证是部分唯一索引：持锁方在目标时段插入一条未提交的预约（模拟正在提交的新预约），改派通过前置检查后在唯一索引上
 * 等待它（pg_stat_activity 确认）。对方提交 → 改派得 SLOT_TAKEN、原预约不动、无日志；对方回滚 → 改派成功。
 */
@DisplayName("ACC-M3-04 改派与新预约争同一时段")
class ReassignVersusBookingTest extends AdminReservationApiTestBase {

    @Autowired
    private DataSource dataSource;

    private LockHolder holder;
    private ExecutorService pool;
    private long target;

    @BeforeEach
    void openHolder() throws Exception {
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
        holder = LockHolder.open(dataSource, jdbc);
        holder.execute("insert into reservation (user_id, resource_id, service_date, start_time, end_time, status)"
                + " values (?, ?, ?, ?, ?, 'CONFIRMED')", lisi, court2, TOMORROW, LocalTime.of(9, 30),
                LocalTime.of(11, 0));
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

    private Future<MvcResult> reassignToCourt2() {
        return pool.submit(() -> asSys(HttpMethod.POST, REASSIGN_RESOURCE, body("resourceId", court2,
                "serviceDate", TOMORROW.toString(), "startTime", "09:30", "reason", "场地调整"), target));
    }

    @Test
    @DisplayName("ACC-M3-04 改派在唯一索引上等待目标时段未提交的新预约；对方提交后改派得 SLOT_TAKEN，原预约不变、无日志")
    void reassignIsSlotTakenWhenTheConcurrentBookingCommits() throws Exception {
        Future<MvcResult> reassign = reassignToCourt2();
        holder.awaitBlocked(reassign);
        holder.commit();

        assertError(reassign.get(60, TimeUnit.SECONDS), ErrorCode.SLOT_TAKEN);
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("resource_id")).isEqualTo(court1);
        assertThat(row.get("admin_note")).isNull();
        assertThat(logCount()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from reservation where resource_id = ? and service_date = ?"
                + " and status = 'CONFIRMED'", Integer.class, court2, TOMORROW)).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-04 改派在唯一索引上等待目标时段未提交的新预约；对方回滚后改派成功并写日志")
    void reassignSucceedsWhenTheConcurrentBookingRollsBack() throws Exception {
        Future<MvcResult> reassign = reassignToCourt2();
        holder.awaitBlocked(reassign);
        holder.rollback();

        assertThat(ok(reassign.get(60, TimeUnit.SECONDS)).get("resourceId").asLong()).isEqualTo(court2);
        assertThat(reservationRow(target).get("resource_id")).isEqualTo(court2);
        assertThat(onlyLog().get("action")).isEqualTo("RESERVATION_REASSIGN_RESOURCE");
    }
}
