package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/** A5：GET /admin/venues/{id}/resources：角色 → NOT_FOUND → FORBIDDEN_SCOPE；含 DISABLED，按 sortOrder、id 排序。 */
class AdminResourcesApiTest extends AbstractApiTest {

    private VenueFixtures fixtures;
    private long sysAdmin;
    private long tennisAdmin;
    private long tennis;
    private long badminton;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        tennis = fixtures.bookableVenue("网球馆");
        badminton = fixtures.venue("羽毛球馆", false, "OPEN");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
    }

    private MvcResult resources(long venueId, long userId, Role role) throws Exception {
        return mockMvc.perform(get("/api/v1/admin/venues/{id}/resources", venueId)
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, role))).andReturn();
    }

    @Test
    void scopedAdminSeesEveryResourceIncludingDisabledInOrder() throws Exception {
        long court3 = fixtures.resource(tennis, "网球场3", 3, "DISABLED");
        long court1 = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        long court2 = fixtures.resource(tennis, "网球场2", 1, "MAINTENANCE");
        fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");

        MvcResult result = resources(tennis, tennisAdmin, Role.VENUE_ADMIN);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.findValuesAsText("id"))
                .containsExactly(String.valueOf(court1), String.valueOf(court2), String.valueOf(court3));
        JsonNode first = body.get(0);
        assertThat(first.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(first.get("name").asText()).isEqualTo("网球场1");
        assertThat(first.get("resourceType").asText()).isEqualTo("COURT");
        assertThat(first.get("sortOrder").asInt()).isEqualTo(1);
        assertThat(first.get("operationalStatus").asText()).isEqualTo("OPEN");
        assertThat(body.get(2).get("operationalStatus").asText()).isEqualTo("DISABLED");
    }

    @Test
    void sysAdminReadsAnyVenue() throws Exception {
        fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");

        assertThat(json(resources(badminton, sysAdmin, Role.SYS_ADMIN))).hasSize(1);
    }

    @Test
    void venueOutsideTheScopeIsForbiddenScope() throws Exception {
        JsonNode body = assertError(resources(badminton, tennisAdmin, Role.VENUE_ADMIN), ErrorCode.FORBIDDEN_SCOPE);

        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(badminton);
    }

    @Test
    void unknownVenueIsNotFoundEvenForAVenueAdmin() throws Exception {
        assertError(resources(999, tennisAdmin, Role.VENUE_ADMIN), ErrorCode.NOT_FOUND);
    }

    @Test
    void roleIsCheckedBeforeTheVenueExists() throws Exception {
        long zhangsan = user("zhangsan", Role.USER);

        assertError(resources(999, zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertError(resources(tennis, zhangsan, Role.USER), ErrorCode.FORBIDDEN);
    }

    @Test
    void nonNumericVenueIdIsAValidationError() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/admin/venues/abc/resources")
                .header(HttpHeaders.AUTHORIZATION, bearer(user("zhangsan", Role.USER), Role.USER))).andReturn();

        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("venueId").asText()).isEqualTo("类型不符");
    }
}
