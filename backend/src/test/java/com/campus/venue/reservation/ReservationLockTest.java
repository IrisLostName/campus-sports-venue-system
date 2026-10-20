package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.LockHolder;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
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
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 并发（ACC-M3-05）：用户取消与签到互相等待预约行锁（ReservationCancelService、ReservationUsageService 的
 * findByIdForUpdate）。持锁方在独立事务里改变预约并提交，被测请求必须读到提交后的状态。时段为今天 09:30–11:00，
 * 时钟 09:20：在签到窗口内，且已过取消截止（开始前 120 分钟）。取消的检查顺序是 ALREADY_CHECKED_IN 先于截止，
 * 所以“取消读到签到”与“取消没读到签到”得到不同的错误码。
 */
@DisplayName("ACC-M3-05 取消与签到的行锁")
class ReservationLockTest extends UsageApiTestBase {

    @Autowired
    private DataSource dataSource;

    private LockHolder holder;
    private ExecutorService pool;

    @BeforeEach
    void openHolder() throws Exception {
        holder = LockHolder.open(dataSource, jdbc);
        pool = Executors.newSingleThreadExecutor();
        clock.setLocal(today(9, 20, 0));
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
    @DisplayName("ACC-M3-05 用户取消等待预约行锁；持锁方插入签到并提交后，取消得 ALREADY_CHECKED_IN（不是截止），预约不变")
    void userCancelWaitsForConcurrentCheckIn() throws Exception {
        long id = todaySlot(zhangsan);
        holder.lockRow("reservation", id);
        holder.execute("insert into usage_record (reservation_id, check_in_at) values (?, ?)", id,
                Timestamp.valueOf(today(9, 19, 0)));

        Future<MvcResult> cancel = pool.submit(() -> cancel(zhangsan, id, null));
        holder.awaitBlocked(cancel);
        holder.commit();

        assertError(cancel.get(60, TimeUnit.SECONDS), ErrorCode.ALREADY_CHECKED_IN);
        Map<String, Object> row = jdbc.queryForMap("select * from reservation where id = ?", id);
        assertThat(row.get("status")).isEqualTo("CONFIRMED");
        assertThat(row.get("cancelled_at")).isNull();
        assertThat(row.get("cancelled_by")).isNull();
        assertThat(usageCount(id)).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-05 签到等待预约行锁；持锁方置 CANCELLED 并提交后，签到得 INVALID_STATE {status: CANCELLED}，无使用记录")
    void checkInWaitsForConcurrentUserCancel() throws Exception {
        long id = todaySlot(zhangsan);
        holder.lockRow("reservation", id);
        holder.execute("update reservation set status = 'CANCELLED', cancelled_at = ?, cancelled_by = ? where id = ?",
                Timestamp.valueOf(today(9, 19, 0)), zhangsan, id);

        Future<MvcResult> checkIn = pool.submit(() -> checkIn(zhangsan, id));
        holder.awaitBlocked(checkIn);
        holder.commit();

        JsonNode body = assertError(checkIn.get(60, TimeUnit.SECONDS), ErrorCode.INVALID_STATE);
        assertThat(body.get("details").get("status").asText()).isEqualTo("CANCELLED");
        assertThat(usageCount(id)).isZero();
        assertThat(status(id)).isEqualTo("CANCELLED");
    }
}
