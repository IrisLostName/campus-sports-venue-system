package com.campus.venue.availability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/** A7：GET /admin/venues/{id}/availability-rules：只返回 ACTIVE；weekly 按星期、开始时间，closures 按开始日期、id 排序。 */
class AvailabilityRulesApiTest extends AbstractApiTest {

    private VenueFixtures fixtures;
    private long sysAdmin;
    private long tennisAdmin;
    private long tennis;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        tennis = fixtures.bookableVenue("网球馆");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
    }

    private MvcResult rules(long venueId, long userId, Role role) throws Exception {
        return mockMvc.perform(get("/api/v1/admin/venues/{id}/availability-rules", venueId)
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, role))).andReturn();
    }

    private static List<String> weekly(JsonNode body) {
        List<String> result = new ArrayList<>();
        body.get("weekly").forEach(window -> result.add(window.get("weekday").asInt() + " "
                + window.get("openTime").asText() + "-" + window.get("closeTime").asText()));
        return result;
    }

    @Test
    void returnsActiveRulesSorted() throws Exception {
        long court = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        long other = fixtures.bookableVenue("羽毛球馆");
        fixtures.weekly(tennis, 3, "14:00", "17:00");
        long firstWindow = fixtures.weekly(tennis, 1, "18:30", "20:00");
        fixtures.weekly(tennis, 1, "08:00", "09:30");
        fixtures.deactivateRule(fixtures.weekly(tennis, 2, "08:00", "09:30"));
        fixtures.weekly(other, 1, "08:00", "09:30");
        long late = fixtures.closure(tennis, null, LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 21));
        long sameDayFirst = fixtures.closure(tennis, court, LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 14));
        fixtures.deactivateRule(fixtures.closure(tennis, null, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)));
        long sameDaySecond = fixtures.closure(tennis, null, LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 15));

        JsonNode body = json(rules(tennis, tennisAdmin, Role.VENUE_ADMIN));

        assertThat(weekly(body)).containsExactly("1 08:00-09:30", "1 18:30-20:00", "3 14:00-17:00");
        assertThat(body.get("weekly").get(1).get("id").asLong()).isEqualTo(firstWindow);
        assertThat(body.get("closures").findValuesAsText("id")).containsExactly(String.valueOf(sameDayFirst),
                String.valueOf(sameDaySecond), String.valueOf(late));
        JsonNode resourceClosure = body.get("closures").get(0);
        assertThat(resourceClosure.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(resourceClosure.get("resourceId").asLong()).isEqualTo(court);
        assertThat(resourceClosure.get("startDate").asText()).isEqualTo("2026-10-14");
        assertThat(resourceClosure.get("endDate").asText()).isEqualTo("2026-10-14");
        assertThat(resourceClosure.get("reason").asText()).isEqualTo("保养");
        assertThat(body.get("closures").get(1).has("resourceId")).isTrue();
        assertThat(body.get("closures").get(1).get("resourceId").isNull()).isTrue();
    }

    @Test
    void venueWithoutRulesReturnsEmptyLists() throws Exception {
        JsonNode body = json(rules(tennis, sysAdmin, Role.SYS_ADMIN));

        assertThat(body.get("weekly")).isEmpty();
        assertThat(body.get("closures")).isEmpty();
    }

    /** ACC-M3-07：场馆管理员访问未授权场馆返回 FORBIDDEN_SCOPE。 */
    @Test
    void venueOutsideTheScopeIsForbiddenScope() throws Exception {
        long badminton = fixtures.venue("羽毛球馆", false, "OPEN");

        JsonNode body = assertError(rules(badminton, tennisAdmin, Role.VENUE_ADMIN), ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(badminton);
    }

    @Test
    void unknownVenueIsNotFound() throws Exception {
        assertError(rules(999, tennisAdmin, Role.VENUE_ADMIN), ErrorCode.NOT_FOUND);
    }

    @Test
    void ordinaryUserIsForbiddenBeforeTheVenueIsLookedUp() throws Exception {
        long zhangsan = user("zhangsan", Role.USER);

        assertError(rules(999, zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertError(rules(tennis, zhangsan, Role.USER), ErrorCode.FORBIDDEN);
    }
}
