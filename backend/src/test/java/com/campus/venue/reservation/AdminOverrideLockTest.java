package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
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
 * BE-5 审计 F1：管理员覆盖必须先锁定预约行（AdminOverrideGuard 的 findByIdForUpdate）。确定性做法，不用 sleep：
 * 测试线程（持锁方 A）在独立的 JDBC 事务里 SELECT … FOR UPDATE 锁住目标预约；另一线程（B）经完整 HTTP 栈发起覆盖；
 * 有截止时间的循环每次查询一次 pg_stat_activity，直到 B 的后端在等 A 持有的锁；A 再改变预约并提交。
 * B 必须读到 A 提交后的状态而得到相应拒绝；无日志、无丢失更新。若覆盖不加锁，B 读到旧状态并覆盖 A 的修改，本测试失败。
 */
class AdminOverrideLockTest extends AdminReservationApiTestBase {

    private static final Duration WAIT_DEADLINE = Duration.ofSeconds(20);

    @Autowired
    private DataSource dataSource;

    private Connection holder;
    private ExecutorService pool;

    @BeforeEach
    void openHolder() throws SQLException {
        holder = dataSource.getConnection();
        holder.setAutoCommit(false);
        pool = Executors.newSingleThreadExecutor();
    }

    @AfterEach
    void closeHolder() throws SQLException {
        try {
            if (!holder.getAutoCommit()) {
                holder.rollback();
            }
        } finally {
            holder.setAutoCommit(true);
            holder.close();
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("ACC-M3-06 人员改派等待预约行锁；持锁方插入签到记录并提交后，改派得 ALREADY_CHECKED_IN，预约人不变、无日志")
    void reassignUserWaitsForConcurrentCheckIn() throws Exception {
        long reservation = reservation(zhangsan, court1, TODAY, "08:30");
        long holderPid = lockReservation(reservation);

        Future<MvcResult> override = pool.submit(() -> asSys(HttpMethod.POST, REASSIGN_USER,
                body("userId", lisi, "reason", "代为预约"), reservation));
        awaitBlockedBy(holderPid, override);
        update("insert into usage_record (reservation_id, check_in_at) values (?, ?)", reservation,
                Timestamp.valueOf(NOW.minusMinutes(5)));
        holder.commit();

        assertError(override.get(60, TimeUnit.SECONDS), ErrorCode.ALREADY_CHECKED_IN);
        Map<String, Object> row = reservationRow(reservation);
        assertThat(row.get("user_id")).isEqualTo(zhangsan);
        assertThat(row.get("status")).isEqualTo("CONFIRMED");
        assertThat(row.get("admin_note")).isNull();
        assertThat(jdbc.queryForObject("select count(*) from usage_record where reservation_id = ?", Integer.class,
                reservation)).isEqualTo(1);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("ACC-M3-06 管理员取消等待预约行锁；持锁方置 CANCELLED 并提交后，取消得 INVALID_STATE {status: CANCELLED}，用户取消不被覆盖、无日志")
    void adminCancelWaitsForConcurrentUserCancel() throws Exception {
        long reservation = reservation(zhangsan, court2, TOMORROW, "09:30");
        long holderPid = lockReservation(reservation);

        Future<MvcResult> override = pool.submit(() -> cancelAsSys(reservation, body("reason", "场地检修")));
        awaitBlockedBy(holderPid, override);
        update("update reservation set status = 'CANCELLED', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?"
                + " where id = ?", Timestamp.valueOf(NOW), zhangsan, "临时有事", reservation);
        holder.commit();

        JsonNode body = assertError(override.get(60, TimeUnit.SECONDS), ErrorCode.INVALID_STATE);
        assertThat(body.get("details")).isEqualTo(objectMapper.valueToTree(Map.of("status", "CANCELLED")));
        Map<String, Object> row = reservationRow(reservation);
        assertThat(row.get("status")).isEqualTo("CANCELLED");
        assertThat(row.get("cancelled_by")).isEqualTo(zhangsan);
        assertThat(row.get("cancel_reason")).isEqualTo("临时有事");
        assertThat(row.get("admin_note")).isNull();
        assertThat(logCount()).isZero();
    }

    /** 在持锁方事务里锁住预约行，返回持锁方的后端进程号。 */
    private long lockReservation(long reservationId) throws SQLException {
        try (PreparedStatement lock = holder.prepareStatement("select id from reservation where id = ? for update")) {
            lock.setLong(1, reservationId);
            try (ResultSet rows = lock.executeQuery()) {
                assertThat(rows.next()).isTrue();
            }
        }
        try (PreparedStatement pid = holder.prepareStatement("select pg_backend_pid()");
                ResultSet rows = pid.executeQuery()) {
            assertThat(rows.next()).isTrue();
            return rows.getLong(1);
        }
    }

    private void update(String sql, Object... args) throws SQLException {
        try (PreparedStatement statement = holder.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) {
                statement.setObject(i + 1, args[i]);
            }
            assertThat(statement.executeUpdate()).isEqualTo(1);
        }
    }

    /**
     * 直到有另一个后端在等待持锁方持有的锁（wait_event_type = 'Lock' 且被 holderPid 阻塞）。
     * 每次循环是一次真实的数据库往返；超过截止时间或覆盖请求提前结束都算失败。
     */
    private void awaitBlockedBy(long holderPid, Future<MvcResult> override) {
        long deadline = System.nanoTime() + WAIT_DEADLINE.toNanos();
        while (System.nanoTime() < deadline) {
            assertThat(override.isDone()).as("覆盖请求未等待预约行锁就已结束").isFalse();
            Integer waiting = jdbc.queryForObject("select count(*) from pg_stat_activity where wait_event_type = 'Lock'"
                    + " and ? = any(pg_blocking_pids(pid))", Integer.class, holderPid);
            if (waiting != null && waiting > 0) {
                return;
            }
        }
        throw new AssertionError("截止时间内覆盖请求没有在等待预约行锁");
    }
}
