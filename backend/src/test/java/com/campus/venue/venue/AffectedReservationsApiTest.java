package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * BE-2b I3、T3：受影响预约 = 有效状态（BE-3 E1）为 CONFIRMED 且结束时刻晚于现在。已结束、已取消、
 * 已越过判定点（有效状态 NO_SHOW）的不算；已签到、尚未结束的算。经关闭场馆的 dryRun 观察（不写数据）。
 * 时钟为 2026-10-12 08:30:15，签到截止为开始后 15 分钟。
 */
class AffectedReservationsApiTest extends ImpactApiTestBase {

    private JsonNode closingImpact() throws Exception {
        return json(asSys(HttpMethod.PATCH, "/api/v1/admin/venues/{id}",
                body("operationalStatus", "CLOSED", "dryRun", true), tennis)).get("impact");
    }

    @Test
    void onlyEffectivelyConfirmedUnfinishedReservationsAreAffected() throws Exception {
        fixtures.reservation(zhangsan, court1, TODAY, "06:30", "CONFIRMED");
        fixtures.reservation(zhangsan, court2, TODAY, "08:00", "CONFIRMED");
        long checkedIn = fixtures.reservation(lisi, court3, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(checkedIn, TODAY.atTime(7, 50), null);
        long later = fixtures.reservation(lisi, court4, TODAY, "09:30", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CANCELLED");
        fixtures.reservation(zhangsan, court2, TOMORROW, "08:00", "ADMIN_CANCELLED");
        fixtures.reservation(zhangsan, court3, TOMORROW, "08:00", "NO_SHOW");
        fixtures.reservation(zhangsan, court4, TOMORROW, "08:00", "COMPLETED");
        fixtures.reservation(zhangsan, badmintonCourt, TOMORROW, "08:00", "CONFIRMED");

        JsonNode impact = closingImpact();

        assertThat(impact.get("affectedCount").asInt()).isEqualTo(2);
        assertThat(briefIds(impact)).containsExactly(checkedIn, later);
    }

    @Test
    void reservationPastItsNoShowPointIsNotAffected() throws Exception {
        long noCheckIn = fixtures.reservation(zhangsan, court2, TODAY, "08:00", "CONFIRMED");

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(8, 15)));
        assertThat(briefIds(closingImpact())).containsExactly(noCheckIn);

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(8, 15, 1)));
        assertThat(closingImpact().get("affectedCount").asInt()).isZero();
        assertThat(reservationStatus(noCheckIn)).isEqualTo("CONFIRMED");
    }

    @Test
    void checkedInReservationStopsCountingAtItsEnd() throws Exception {
        long checkedIn = fixtures.reservation(zhangsan, court2, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(checkedIn, TODAY.atTime(7, 55), null);

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 29, 59)));
        assertThat(briefIds(closingImpact())).containsExactly(checkedIn);

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 30)));
        assertThat(closingImpact().get("affectedCount").asInt()).isZero();
    }

    @Test
    void cancelAlsoCancelsCheckedInUnfinishedReservation() throws Exception {
        long checkedIn = fixtures.reservation(zhangsan, court2, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(checkedIn, TODAY.atTime(7, 55), null);

        JsonNode response = json(asSys(HttpMethod.PATCH, "/api/v1/admin/resources/{id}",
                body("operationalStatus", "MAINTENANCE", "onExistingReservations", "CANCEL", "reason", "漏水"), court2));

        assertThat(ids(response.get("cancelledIds"))).containsExactly(checkedIn);
        assertThat(reservationStatus(checkedIn)).isEqualTo("ADMIN_CANCELLED");
    }
}
