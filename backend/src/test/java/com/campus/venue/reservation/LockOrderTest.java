package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.support.LockHolder;
import com.campus.venue.user.domain.Role;
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
 * TEST-1 K2（BE-2b N2、G8）：全系统加锁顺序 用户行 → 场馆行 → 预约行。确定性做法：持锁方让被测请求停在“后一把锁”上
 * （pg_stat_activity 确认），此时在第三个连接上以 NOWAIT 尝试锁“前一把锁”的行，必须得 55P03（已被被测请求持有）。
 * 若被测请求反过来先等后一把锁、再取前一把锁，NOWAIT 能拿到锁，本测试失败。没有任何路径同时锁用户行与场馆行，
 * 所以两条用例覆盖了所有成对的顺序。
 */
@DisplayName("TEST-1 K2 加锁顺序")
class LockOrderTest extends ImpactApiTestBase {

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
    @DisplayName("TEST-1 K2 影响检查执行（新增关闭 + CANCEL）在等受影响预约的行锁时，已持有场馆行锁；放行后预约被管理员取消")
    void venueChangeHoldsTheVenueRowWhileWaitingForAReservationRow() throws Exception {
        long affected = reservation(zhangsan, court4, TOMORROW, "09:30");
        holder.lockRow("reservation", affected);

        Future<MvcResult> closure = pool.submit(() -> asSys(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures",
                body("startDate", TOMORROW.toString(), "endDate", TOMORROW.toString(), "resourceId", court4,
                        "onExistingReservations", "CANCEL", "reason", "设备检修"), tennis));
        holder.awaitBlocked(closure);
        LockHolder.assertRowLockedElsewhere(jdbc, "venue", tennis);
        holder.commit();

        assertThat(closure.get(60, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(201);
        assertThat(reservationStatus(affected)).isEqualTo("ADMIN_CANCELLED");
    }

    @Test
    @DisplayName("TEST-1 K2 创建预约在唯一索引上等待同一时段未提交的预约时，已持有预约人的用户行锁；对方回滚后创建成功")
    void bookingHoldsTheUserRowWhileWaitingOnTheSlotIndex() throws Exception {
        holder.execute("insert into reservation (user_id, resource_id, service_date, start_time, end_time, status)"
                + " values (?, ?, ?, ?, ?, 'CONFIRMED')", lisi, court1, TOMORROW, LocalTime.of(9, 30),
                LocalTime.of(11, 0));

        Future<MvcResult> booking = pool.submit(() -> send(HttpMethod.POST, "/api/v1/reservations",
                body("resourceId", court1, "serviceDate", TOMORROW.toString(), "startTime", "09:30"), zhangsan,
                Role.USER));
        holder.awaitBlocked(booking);
        LockHolder.assertRowLockedElsewhere(jdbc, "app_user", zhangsan);
        holder.rollback();

        MvcResult created = booking.get(60, TimeUnit.SECONDS);
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(created).get("userId").asLong()).isEqualTo(zhangsan);
    }
}
