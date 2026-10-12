package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
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
import org.springframework.test.web.servlet.MvcResult;

/**
 * A6、T2、T3：GET /admin/venues/{id}/occupancy。全部场地（含 DISABLED）；管理端没有 MINE；
 * reservation 带 displayStatus；不限日期；阶段顺序 date 格式 → 角色 → NOT_FOUND → FORBIDDEN_SCOPE。
 * 时钟为 2026-10-12（周一）08:30:15。
 */
class OccupancyApiTest extends AbstractApiTest {

    private static final LocalDate TODAY = MutableClock.START.toLocalDate();
    private static final LocalDate TOMORROW = TODAY.plusDays(1);

    private VenueFixtures fixtures;
    private long sysAdmin;
    private long tennisAdmin;
    private long zhangsan;
    private long tennis;
    private long court1;
    private long court3;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        zhangsan = user("zhangsan", Role.USER);
        tennis = fixtures.bookableVenue("网球馆");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        court1 = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        fixtures.resource(tennis, "网球场2", 2, "MAINTENANCE");
        court3 = fixtures.resource(tennis, "网球场3", 3, "DISABLED");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
    }

    private MvcResult occupancy(long venueId, String date, long userId, Role role) throws Exception {
        return mockMvc.perform(get("/api/v1/admin/venues/{id}/occupancy", venueId).param("date", date)
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, role))).andReturn();
    }

    private JsonNode adminView(LocalDate date) throws Exception {
        MvcResult result = occupancy(tennis, date.toString(), tennisAdmin, Role.VENUE_ADMIN);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json(result);
    }

    private static JsonNode slot(JsonNode body, int resource, String start) {
        for (JsonNode slot : body.get("resources").get(resource).get("slots")) {
            if (slot.get("startTime").asText().equals(start)) {
                return slot;
            }
        }
        throw new AssertionError("没有时段 " + start);
    }

    private static List<String> statuses(JsonNode body, int resource) {
        List<String> result = new ArrayList<>();
        body.get("resources").get(resource).get("slots").forEach(slot -> result.add(slot.get("status").asText()));
        return result;
    }

    @Test
    void listsEveryResourceIncludingDisabledWithClosedSlots() throws Exception {
        JsonNode body = adminView(TOMORROW);

        assertThat(body.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(body.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(body.get("date").asText()).isEqualTo("2026-10-13");
        assertThat(body.get("resourceCount").asLong()).isEqualTo(2);
        assertThat(body.get("resources").findValuesAsText("resourceName")).containsExactly("网球场1", "网球场2", "网球场3");
        assertThat(body.get("resources").findValuesAsText("operationalStatus"))
                .containsExactly("OPEN", "MAINTENANCE", "DISABLED");
        assertThat(statuses(body, 0)).hasSize(8).containsOnly("AVAILABLE");
        assertThat(statuses(body, 1)).hasSize(8).containsOnly("CLOSED");
        assertThat(statuses(body, 2)).hasSize(8).containsOnly("CLOSED");
        JsonNode first = slot(body, 0, "08:00");
        assertThat(first.get("endTime").asText()).isEqualTo("09:30");
        assertThat(first.has("reservation")).isTrue();
        assertThat(first.get("reservation").isNull()).isTrue();
    }

    @Test
    void activeReservationIsBookedWithOccupantAndNeverMine() throws Exception {
        long id = fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CANCELLED");

        JsonNode body = adminView(TOMORROW);
        JsonNode booked = slot(body, 0, "08:00");
        assertThat(booked.get("status").asText()).isEqualTo("BOOKED");
        assertThat(booked.get("reservation").get("id").asLong()).isEqualTo(id);
        assertThat(booked.get("reservation").get("userDisplayName").asText()).isEqualTo("用户zhangsan");
        assertThat(booked.get("reservation").get("displayStatus").asText()).isEqualTo("UPCOMING");
        assertThat(slot(body, 0, "09:30").get("status").asText()).isEqualTo("AVAILABLE");
        assertThat(slot(body, 0, "09:30").get("reservation").isNull()).isTrue();
    }

    @Test
    void displayStatusFollowsTheClockAndUsageRecords() throws Exception {
        long inUse = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(inUse, LocalDateTime.of(TODAY, LocalTime.of(7, 55)), null);
        fixtures.reservation(zhangsan, court1, TODAY, "09:30", "CONFIRMED");
        fixtures.reservation(zhangsan, court3, TODAY, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court3, TODAY, "11:00", "CONFIRMED");

        JsonNode body = adminView(TODAY);
        assertThat(slot(body, 0, "08:00").get("status").asText()).isEqualTo("PAST");
        assertThat(slot(body, 0, "08:00").get("reservation").get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(slot(body, 0, "09:30").get("reservation").get("displayStatus").asText()).isEqualTo("UPCOMING");
        assertThat(slot(body, 2, "08:00").get("reservation").get("displayStatus").asText()).isEqualTo("NO_SHOW");
        // 停用场地的时段仍按 D3 优先级：已开始为 PAST，有效预约为 BOOKED（裁决第 10 节第 4 条）
        assertThat(slot(body, 2, "08:00").get("status").asText()).isEqualTo("PAST");
        assertThat(slot(body, 2, "11:00").get("status").asText()).isEqualTo("BOOKED");

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 15)));
        JsonNode later = adminView(TODAY);
        assertThat(slot(later, 0, "09:30").get("status").asText()).isEqualTo("BOOKED");
        assertThat(slot(later, 0, "09:30").get("reservation").get("displayStatus").asText())
                .isEqualTo("CHECKIN_OPEN");
    }

    @Test
    void anyDateMayBeViewed() throws Exception {
        assertThat(statuses(adminView(LocalDate.of(2026, 9, 1)), 0)).hasSize(8).containsOnly("PAST");
        assertThat(statuses(adminView(TODAY.plusDays(30)), 0)).hasSize(8).containsOnly("AVAILABLE");
    }

    @Test
    void closedVenueShowsClosedSlotsButKeepsBookings() throws Exception {
        jdbc.update("update venue set operational_status = 'CLOSED' where id = ?", tennis);
        fixtures.reservation(zhangsan, court1, TOMORROW, "11:00", "CONFIRMED");

        JsonNode body = adminView(TOMORROW);
        assertThat(slot(body, 0, "09:30").get("status").asText()).isEqualTo("CLOSED");
        assertThat(slot(body, 0, "11:00").get("status").asText()).isEqualTo("BOOKED");
    }

    @Test
    void sysAdminSeesAnyVenue() throws Exception {
        assertThat(occupancy(tennis, TOMORROW.toString(), sysAdmin, Role.SYS_ADMIN).getResponse().getStatus())
                .isEqualTo(200);
    }

    @Test
    void dateFormatIsCheckedBeforeTheRole() throws Exception {
        JsonNode body = assertError(occupancy(999, "2026-13-01", zhangsan, Role.USER), ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("date").asText()).isEqualTo("类型不符");

        MvcResult missing = mockMvc.perform(get("/api/v1/admin/venues/{id}/occupancy", tennis)
                .header(HttpHeaders.AUTHORIZATION, bearer(tennisAdmin, Role.VENUE_ADMIN))).andReturn();
        assertThat(assertError(missing, ErrorCode.VALIDATION_ERROR).get("details").get("fields").get("date").asText())
                .isEqualTo("缺少必填参数");
    }

    @Test
    void ordinaryUserIsForbidden() throws Exception {
        assertError(occupancy(999, TODAY.toString(), zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertError(occupancy(tennis, TODAY.toString(), zhangsan, Role.USER), ErrorCode.FORBIDDEN);
    }

    @Test
    void unknownVenueIsNotFound() throws Exception {
        assertError(occupancy(999, TODAY.toString(), tennisAdmin, Role.VENUE_ADMIN), ErrorCode.NOT_FOUND);
    }

    @Test
    void venueOutsideTheScopeIsForbiddenScope() throws Exception {
        long badminton = fixtures.venue("羽毛球馆", false, "OPEN");

        JsonNode body = assertError(occupancy(badminton, TODAY.toString(), tennisAdmin, Role.VENUE_ADMIN),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(badminton);
    }
}
