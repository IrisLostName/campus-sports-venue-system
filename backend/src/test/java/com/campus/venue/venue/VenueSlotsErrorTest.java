package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * T3、A2：用户端时段的错误码与阶段顺序：date 格式 → NOT_FOUND → VENUE_NOT_BOOKABLE → DATE_OUT_OF_RANGE。
 * 可预约日期为 [今天, 今天 + advanceDays)，advanceDays 取 BookingProperties；今天 = 2026-10-12。
 */
class VenueSlotsErrorTest extends AbstractApiTest {

    private static final LocalDate TODAY = MutableClock.START.toLocalDate();

    @Autowired
    private BookingProperties properties;

    private VenueFixtures fixtures;
    private String token;
    private long tennis;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        token = bearer(user("zhangsan", Role.USER), Role.USER);
        tennis = fixtures.bookableVenue("网球馆");
        fixtures.resource(tennis, "网球场1", 1, "OPEN");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
    }

    private MockHttpServletRequestBuilder request(long venueId) {
        return get("/api/v1/venues/{id}/slots", venueId).header(HttpHeaders.AUTHORIZATION, token);
    }

    private MvcResult slots(long venueId, String date) throws Exception {
        return mockMvc.perform(request(venueId).param("date", date)).andReturn();
    }

    private void assertDateField(MvcResult result, String message) throws Exception {
        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("date").asText()).isEqualTo(message);
    }

    @Test
    void missingDateIsAValidationError() throws Exception {
        assertDateField(mockMvc.perform(request(tennis)).andReturn(), "缺少必填参数");
    }

    @Test
    void malformedDatesAreValidationErrors() throws Exception {
        for (String date : new String[] {"abc", "2026-1-5", "2026-02-30", "2026/10/13", "20261013", "2026-10-13T08:00"}) {
            assertDateField(slots(tennis, date), "类型不符");
        }
    }

    @Test
    void dateFormatIsCheckedBeforeTheVenueExists() throws Exception {
        assertDateField(slots(999, "bad"), "类型不符");
    }

    @Test
    void unknownVenueIsNotFound() throws Exception {
        assertError(slots(999, TODAY.toString()), ErrorCode.NOT_FOUND);
    }

    @Test
    void venueWithBookingDisabledIsNotBookable() throws Exception {
        long badminton = fixtures.venue("羽毛球馆", false, "OPEN");
        fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");

        assertError(slots(badminton, TODAY.toString()), ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    void closedVenueIsNotBookable() throws Exception {
        long closed = fixtures.venue("游泳馆", true, "CLOSED");

        assertError(slots(closed, TODAY.toString()), ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    void notBookableIsReportedBeforeDateOutOfRange() throws Exception {
        long badminton = fixtures.venue("羽毛球馆", false, "OPEN");

        assertError(slots(badminton, TODAY.minusDays(1).toString()), ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    void todayPlusAdvanceDaysIsOutOfRange() throws Exception {
        JsonNode body = assertError(slots(tennis, TODAY.plusDays(properties.advanceDays()).toString()),
                ErrorCode.DATE_OUT_OF_RANGE);

        assertThat(body.get("details").get("advanceDays").asInt()).isEqualTo(properties.advanceDays());
    }

    @Test
    void yesterdayIsOutOfRange() throws Exception {
        JsonNode body = assertError(slots(tennis, TODAY.minusDays(1).toString()), ErrorCode.DATE_OUT_OF_RANGE);

        assertThat(body.get("details").get("advanceDays").asInt()).isEqualTo(properties.advanceDays());
    }

    @Test
    void todayAndTheLastBookableDayAreAccepted() throws Exception {
        for (LocalDate date : new LocalDate[] {TODAY, TODAY.plusDays(properties.advanceDays() - 1)}) {
            MvcResult result = slots(tennis, date.toString());
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            assertThat(json(result).get("date").asText()).isEqualTo(date.toString());
        }
    }

    @Test
    void anyRoleMayQuerySlots() throws Exception {
        long admin = user("sysadmin", Role.SYS_ADMIN);
        MvcResult result = mockMvc.perform(get("/api/v1/venues/{id}/slots", tennis).param("date", TODAY.toString())
                .header(HttpHeaders.AUTHORIZATION, bearer(admin, Role.SYS_ADMIN))).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void anonymousCallerMustLogIn() throws Exception {
        assertError(mockMvc.perform(get("/api/v1/venues/{id}/slots", tennis).param("date", TODAY.toString()))
                .andReturn(), ErrorCode.AUTH_REQUIRED);
        assertError(mockMvc.perform(get("/api/v1/venues")).andReturn(), ErrorCode.AUTH_REQUIRED);
    }
}
