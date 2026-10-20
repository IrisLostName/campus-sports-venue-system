package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
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
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 并发（ACC-M3-06）：影响检查 CANCEL 执行时按 id 锁定受影响预约（ReservationRepository.lockUnfinishedConfirmed）。
 * 持锁方锁住其中一条并以用户身份取消，被测的新增关闭在等它（pg_stat_activity 确认）；持锁方提交后，锁定查询重新检查条件，
 * 该条不再是 CONFIRMED，于是不被覆盖为 ADMIN_CANCELLED，也不出现在取消清单与日志中。若不加锁，按实体整行写回会覆盖用户取消。
 */
@DisplayName("ACC-M3-06 影响检查 CANCEL 与并发用户取消")
class ImpactLockTest extends ImpactApiTestBase {

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
    @DisplayName("ACC-M3-06 新增关闭（CANCEL）等待受影响预约的行锁；持锁方用户取消并提交后，该预约保持 CANCELLED，只取消其余受影响预约")
    void impactCancelWaitsForConcurrentUserCancel() throws Exception {
        long raced = reservation(zhangsan, court4, TOMORROW, "09:30");
        long other = reservation(lisi, court4, TOMORROW, "11:00");
        holder.lockRow("reservation", raced);
        holder.execute("update reservation set status = 'CANCELLED', cancelled_at = ?, cancelled_by = ?,"
                + " cancel_reason = ? where id = ?", Timestamp.valueOf(NOW), zhangsan, "临时有事", raced);

        Future<MvcResult> closure = pool.submit(() -> asSys(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures",
                body("startDate", TOMORROW.toString(), "endDate", TOMORROW.toString(), "resourceId", court4,
                        "onExistingReservations", "CANCEL", "reason", "设备检修"), tennis));
        holder.awaitBlocked(closure);
        holder.commit();

        MvcResult result = closure.get(60, TimeUnit.SECONDS);
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(ids(json(result).get("cancelledIds"))).containsExactly(other);
        Map<String, Object> row = reservationRow(raced);
        assertThat(row.get("status")).isEqualTo("CANCELLED");
        assertThat(row.get("cancelled_by")).isEqualTo(zhangsan);
        assertThat(row.get("cancel_reason")).isEqualTo("临时有事");
        assertThat(row.get("admin_note")).isNull();
        assertThat(reservationStatus(other)).isEqualTo("ADMIN_CANCELLED");
        JsonNode after = snapshot(onlyLog(), "after_snapshot");
        assertThat(ids(after.get("affectedReservationIds"))).containsExactly(other);
    }
}
