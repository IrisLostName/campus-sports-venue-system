package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/**
 * T2：用户端时段派生（GET /venues/{id}/slots）。时钟为 2026-10-12（周一）08:30:15。
 * 场地：网球场1、网球场2 为 OPEN，网球场3 为 MAINTENANCE，网球场0 为 DISABLED（不出现）。
 */
class VenueSlotsApiTest extends AbstractApiTest {

    private static final LocalDate TODAY = MutableClock.START.toLocalDate();
    private static final LocalDate TOMORROW = TODAY.plusDays(1);
    private static final List<String> ALL_AVAILABLE = List.of("08:00=AVAILABLE", "09:30=AVAILABLE",
            "11:00=AVAILABLE", "12:30=AVAILABLE", "14:00=AVAILABLE", "15:30=AVAILABLE", "17:00=AVAILABLE",
            "18:30=AVAILABLE");

    private VenueFixtures fixtures;
    private long zhangsan;
    private long lisi;
    private long tennis;
    private long court1;
    private long court2;
    private long court3;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        zhangsan = user("zhangsan", Role.USER);
        lisi = user("lisi", Role.USER);
        tennis = fixtures.bookableVenue("网球馆");
        // 插入顺序与排序不同：结果须按 sortOrder、再按 id 排序
        court2 = fixtures.resource(tennis, "网球场2", 2, "OPEN");
        court1 = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        court3 = fixtures.resource(tennis, "网球场3", 2, "MAINTENANCE");
        fixtures.resource(tennis, "网球场0", 0, "DISABLED");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
    }

    private JsonNode slots(long userId, long venueId, LocalDate date) throws Exception {
        return json(mockMvc.perform(get("/api/v1/venues/{id}/slots", venueId).param("date", date.toString())
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, Role.USER))).andReturn());
    }

    /** 第 index 个场地的时段，形如 “08:00=AVAILABLE”。 */
    private static List<String> statuses(JsonNode body, int index) {
        List<String> result = new ArrayList<>();
        body.get("resources").get(index).get("slots")
                .forEach(slot -> result.add(slot.get("startTime").asText() + "=" + slot.get("status").asText()));
        return result;
    }

    private static String statusAt(JsonNode body, int index, String start) {
        return statuses(body, index).stream().filter(entry -> entry.startsWith(start + "=")).findFirst()
                .map(entry -> entry.substring(entry.indexOf('=') + 1)).orElseThrow();
    }

    @Test
    void seedLikeVenueHasEightSlotsPerVisibleResourceInSortOrder() throws Exception {
        JsonNode body = slots(zhangsan, tennis, TOMORROW);

        assertThat(body.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(body.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(body.get("date").asText()).isEqualTo("2026-10-13");
        assertThat(body.get("resources")).hasSize(3);
        assertThat(body.get("resources").findValuesAsText("resourceName")).containsExactly("网球场1", "网球场2", "网球场3");
        assertThat(body.get("resources").findValuesAsText("resourceId"))
                .containsExactly(String.valueOf(court1), String.valueOf(court2), String.valueOf(court3));
        assertThat(body.get("resources").findValuesAsText("operationalStatus"))
                .containsExactly("OPEN", "OPEN", "MAINTENANCE");
        assertThat(statuses(body, 0)).isEqualTo(ALL_AVAILABLE);
        JsonNode first = body.get("resources").get(0).get("slots").get(0);
        assertThat(first.get("startTime").asText()).isEqualTo("08:00");
        assertThat(first.get("endTime").asText()).isEqualTo("09:30");
        assertThat(body.get("resources").get(0).get("slots").get(7).get("endTime").asText()).isEqualTo("20:00");
    }

    @Test
    void maintenanceResourceIsListedWithClosedSlots() throws Exception {
        assertThat(statuses(slots(zhangsan, tennis, TOMORROW), 2)).allMatch(entry -> entry.endsWith("=CLOSED"))
                .hasSize(8);
    }

    @Test
    void multipleWindowsAreSortedAndRemaindersDropped() throws Exception {
        long hall = fixtures.bookableVenue("篮球馆");
        fixtures.resource(hall, "篮球场1", 1, "OPEN");
        fixtures.weekly(hall, 2, "14:00", "17:00");
        fixtures.weekly(hall, 2, "08:00", "11:59");

        assertThat(statuses(slots(zhangsan, hall, TOMORROW), 0))
                .containsExactly("08:00=AVAILABLE", "09:30=AVAILABLE", "14:00=AVAILABLE", "15:30=AVAILABLE");
    }

    @Test
    void weekdayMappingIsMondayOneToSundaySeven() throws Exception {
        long hall = fixtures.bookableVenue("篮球馆");
        fixtures.resource(hall, "篮球场1", 1, "OPEN");
        fixtures.weekly(hall, 1, "18:30", "20:00");
        fixtures.weekly(hall, 7, "08:00", "09:30");

        assertThat(statuses(slots(zhangsan, hall, TODAY), 0)).containsExactly("18:30=AVAILABLE");
        assertThat(statuses(slots(zhangsan, hall, LocalDate.of(2026, 10, 18)), 0)).containsExactly("08:00=AVAILABLE");
        assertThat(statuses(slots(zhangsan, hall, TOMORROW), 0)).isEmpty();
    }

    @Test
    void wholeVenueClosureClosesEveryResource() throws Exception {
        fixtures.closure(tennis, null, TOMORROW, TOMORROW);

        JsonNode body = slots(zhangsan, tennis, TOMORROW);
        for (int i = 0; i < 3; i++) {
            assertThat(statuses(body, i)).hasSize(8).allMatch(entry -> entry.endsWith("=CLOSED"));
        }
    }

    @Test
    void resourceClosureClosesOnlyThatResource() throws Exception {
        fixtures.closure(tennis, court1, TOMORROW, TOMORROW);

        JsonNode body = slots(zhangsan, tennis, TOMORROW);
        assertThat(statuses(body, 0)).hasSize(8).allMatch(entry -> entry.endsWith("=CLOSED"));
        assertThat(statuses(body, 1)).isEqualTo(ALL_AVAILABLE);
    }

    @Test
    void closureDateRangeIncludesBothEndsAndInactiveClosuresAreIgnored() throws Exception {
        fixtures.closure(tennis, null, TOMORROW, TOMORROW.plusDays(2));
        fixtures.deactivateRule(fixtures.closure(tennis, null, TOMORROW.plusDays(4), TOMORROW.plusDays(4)));

        assertThat(statusAt(slots(zhangsan, tennis, TOMORROW), 1, "08:00")).isEqualTo("CLOSED");
        assertThat(statusAt(slots(zhangsan, tennis, TOMORROW.plusDays(2)), 1, "08:00")).isEqualTo("CLOSED");
        assertThat(statusAt(slots(zhangsan, tennis, TOMORROW.plusDays(3)), 1, "08:00")).isEqualTo("AVAILABLE");
        assertThat(statusAt(slots(zhangsan, tennis, TOMORROW.plusDays(4)), 1, "08:00")).isEqualTo("AVAILABLE");
    }

    @Test
    void slotStartingExactlyNowIsPast() throws Exception {
        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 30)));
        JsonNode atStart = slots(zhangsan, tennis, TODAY);
        assertThat(statusAt(atStart, 0, "08:00")).isEqualTo("PAST");
        assertThat(statusAt(atStart, 0, "09:30")).isEqualTo("PAST");
        assertThat(statusAt(atStart, 0, "11:00")).isEqualTo("AVAILABLE");

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 29, 59)));
        assertThat(statusAt(slots(zhangsan, tennis, TODAY), 0, "09:30")).isEqualTo("AVAILABLE");
    }

    @Test
    void mineAndBookedDependOnTheViewer() throws Exception {
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "CONFIRMED");

        JsonNode asZhangsan = slots(zhangsan, tennis, TOMORROW);
        assertThat(statusAt(asZhangsan, 0, "08:00")).isEqualTo("MINE");
        assertThat(statusAt(asZhangsan, 0, "09:30")).isEqualTo("BOOKED");
        assertThat(statusAt(asZhangsan, 1, "08:00")).isEqualTo("AVAILABLE");
        JsonNode asLisi = slots(lisi, tennis, TOMORROW);
        assertThat(statusAt(asLisi, 0, "08:00")).isEqualTo("BOOKED");
        assertThat(statusAt(asLisi, 0, "09:30")).isEqualTo("MINE");
    }

    @Test
    void cancelledReservationsDoNotOccupyButTerminalOnesDo() throws Exception {
        fixtures.reservation(lisi, court1, TOMORROW, "08:00", "CANCELLED");
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "ADMIN_CANCELLED");
        fixtures.reservation(lisi, court1, TOMORROW, "11:00", "COMPLETED");
        fixtures.reservation(lisi, court1, TOMORROW, "12:30", "NO_SHOW");

        JsonNode body = slots(zhangsan, tennis, TOMORROW);
        assertThat(statusAt(body, 0, "08:00")).isEqualTo("AVAILABLE");
        assertThat(statusAt(body, 0, "09:30")).isEqualTo("AVAILABLE");
        assertThat(statusAt(body, 0, "11:00")).isEqualTo("BOOKED");
        assertThat(statusAt(body, 0, "12:30")).isEqualTo("BOOKED");
    }

    @Test
    void pastBeatsBookedAndBookedBeatsClosed() throws Exception {
        fixtures.reservation(lisi, court1, TODAY, "08:00", "CONFIRMED");
        assertThat(statusAt(slots(zhangsan, tennis, TODAY), 0, "08:00")).isEqualTo("PAST");

        fixtures.closure(tennis, court1, TOMORROW, TOMORROW);
        fixtures.reservation(lisi, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court3, TOMORROW, "09:30", "CONFIRMED");
        JsonNode body = slots(zhangsan, tennis, TOMORROW);
        assertThat(statusAt(body, 0, "08:00")).isEqualTo("BOOKED");
        assertThat(statusAt(body, 0, "09:30")).isEqualTo("CLOSED");
        assertThat(statusAt(body, 2, "09:30")).isEqualTo("MINE");
        assertThat(statusAt(body, 2, "08:00")).isEqualTo("CLOSED");
    }
}
