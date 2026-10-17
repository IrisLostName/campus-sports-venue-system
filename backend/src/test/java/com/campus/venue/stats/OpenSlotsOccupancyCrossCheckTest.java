package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/**
 * BE-7 T3 对照：总览单日的 openSlots 与 GET /admin/venues/{id}/occupancy 同日 AVAILABLE 时段数（可用场地 × 时段）一致。
 * 只取未来日期且不放预约，使占用总览里没有 PAST 与 BOOKED。TODAY 为周一。
 */
class OpenSlotsOccupancyCrossCheckTest extends StatsTestBase {

    private long venue;
    private long sysAdmin;

    @BeforeEach
    void seed() {
        venue = fixtures.bookableVenue("网球馆");
        fixtures.resource(venue, "1号", 1, "OPEN");
        long court2 = fixtures.resource(venue, "2号", 2, "OPEN");
        fixtures.resource(venue, "3号", 3, "MAINTENANCE");
        fixtures.resource(venue, "4号", 4, "DISABLED");
        fixtures.weekly(venue, 1, "08:00", "11:00");
        fixtures.weekly(venue, 1, "14:00", "17:00");
        fixtures.weekly(venue, 2, "08:00", "20:00");
        fixtures.weekly(venue, 3, "13:00", "14:30");
        fixtures.weekly(venue, 6, "10:00", "11:30");
        fixtures.closure(venue, null, TODAY.plusDays(1), TODAY.plusDays(1));
        fixtures.closure(venue, court2, TODAY.plusDays(7), TODAY.plusDays(8));
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
    }

    private long availableInOccupancy(LocalDate date) throws Exception {
        JsonNode body = json(mockMvc.perform(get("/api/v1/admin/venues/" + venue + "/occupancy")
                .param("date", date.toString())
                .header(HttpHeaders.AUTHORIZATION, bearer(sysAdmin, Role.SYS_ADMIN))).andReturn());
        return body.get("resources").findValuesAsText("status").stream()
                .filter("AVAILABLE"::equals)
                .count();
    }

    @Test
    @DisplayName("未来 13 天逐日：总览 openSlots = 占用总览的 AVAILABLE 时段数；区间合计等于逐日之和")
    void openSlotsMatchTheOccupancyGrid() throws Exception {
        long sum = 0;
        long nonZeroDays = 0;
        for (LocalDate date = TODAY.plusDays(1); !date.isAfter(TODAY.plusDays(13)); date = date.plusDays(1)) {
            JsonNode body = overviewOk(sysAdmin, Role.SYS_ADMIN, "venueId", String.valueOf(venue),
                    "dateFrom", date.toString(), "dateTo", date.toString());
            long open = body.get("openSlots").asLong();
            assertThat(open).as(date.toString()).isEqualTo(availableInOccupancy(date));
            sum += open;
            nonZeroDays += open > 0 ? 1 : 0;
        }

        assertThat(nonZeroDays).isGreaterThanOrEqualTo(5);
        JsonNode whole = overviewOk(sysAdmin, Role.SYS_ADMIN, "venueId", String.valueOf(venue),
                "dateFrom", TODAY.plusDays(1).toString(), "dateTo", TODAY.plusDays(13).toString());
        assertThat(whole.get("openSlots").asLong()).isEqualTo(sum);
    }
}
