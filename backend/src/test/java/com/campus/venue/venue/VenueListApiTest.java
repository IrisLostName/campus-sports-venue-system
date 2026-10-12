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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/** A1、A3：GET /venues 与 GET /admin/venues（字段、bookable、resourceCount、排序、授权口径）。 */
class VenueListApiTest extends AbstractApiTest {

    private static final LocalDate TODAY = MutableClock.START.toLocalDate();

    private VenueFixtures fixtures;
    private long sysAdmin;
    private long tennis;
    private long badminton;
    private long pool;

    @BeforeEach
    void seed() {
        fixtures = new VenueFixtures(jdbc);
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennis = fixtures.bookableVenue("网球馆");
        badminton = fixtures.venue("羽毛球馆", false, "OPEN");
        pool = fixtures.venue("游泳馆", true, "CLOSED");
        fixtures.resource(tennis, "网球场1", 1, "OPEN");
        fixtures.resource(tennis, "网球场2", 2, "MAINTENANCE");
        fixtures.resource(tennis, "网球场3", 3, "DISABLED");
        fixtures.resource(badminton, "羽毛球场1", 1, "DISABLED");
        jdbc.update("update venue set location = '东区', description = '室外' where id = ?", tennis);
    }

    private MvcResult call(String path, long userId, Role role) throws Exception {
        return mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer(userId, role))).andReturn();
    }

    @Test
    void userSeesAllVenuesOrderedByIdWithDerivedFields() throws Exception {
        MvcResult result = call("/api/v1/venues", user("zhangsan", Role.USER), Role.USER);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.findValuesAsText("name")).containsExactly("网球馆", "羽毛球馆", "游泳馆");
        JsonNode first = body.get(0);
        assertThat(first.get("id").asLong()).isEqualTo(tennis);
        assertThat(first.get("venueType").asText()).isEqualTo("TENNIS");
        assertThat(first.get("location").asText()).isEqualTo("东区");
        assertThat(first.get("description").asText()).isEqualTo("室外");
        assertThat(first.get("operationalStatus").asText()).isEqualTo("OPEN");
        assertThat(first.get("userBookingEnabled").asBoolean()).isTrue();
        assertThat(first.get("bookable").asBoolean()).isTrue();
        assertThat(first.get("resourceCount").asLong()).isEqualTo(2);
        assertThat(body.get(1).get("bookable").asBoolean()).isFalse();
        assertThat(body.get(1).get("resourceCount").asLong()).isZero();
        assertThat(body.get(1).get("location").isNull()).isTrue();
        assertThat(body.get(1).get("description").isNull()).isTrue();
        assertThat(body.get(2).get("userBookingEnabled").asBoolean()).isTrue();
        assertThat(body.get(2).get("bookable").asBoolean()).isFalse();
    }

    @Test
    void sysAdminManagesEveryVenueWithoutScopes() throws Exception {
        JsonNode body = json(call("/api/v1/admin/venues", sysAdmin, Role.SYS_ADMIN));

        assertThat(body.findValuesAsText("id"))
                .containsExactly(String.valueOf(tennis), String.valueOf(badminton), String.valueOf(pool));
        assertThat(body.get(0).get("resourceCount").asLong()).isEqualTo(2);
    }

    @Test
    void venueAdminSeesOnlyCurrentlyEffectiveScopesOrderedById() throws Exception {
        long admin = user("admin_pool", Role.VENUE_ADMIN);
        fixtures.grant(admin, pool, sysAdmin);
        fixtures.grant(admin, badminton, sysAdmin);
        fixtures.grant(admin, tennis, "REVOKED", null, null, sysAdmin);

        JsonNode body = json(call("/api/v1/admin/venues", admin, Role.VENUE_ADMIN));
        assertThat(body.findValuesAsText("id")).containsExactly(String.valueOf(badminton), String.valueOf(pool));

        jdbc.update("update admin_venue_scope set valid_to = ? where venue_id = ?", TODAY.minusDays(1), badminton);
        assertThat(json(call("/api/v1/admin/venues", admin, Role.VENUE_ADMIN)).findValuesAsText("id"))
                .containsExactly(String.valueOf(pool));
    }

    @Test
    void venueAdminWithoutScopesGetsAnEmptyList() throws Exception {
        long admin = user("admin_none", Role.VENUE_ADMIN);

        assertThat(json(call("/api/v1/admin/venues", admin, Role.VENUE_ADMIN))).isEmpty();
    }

    @Test
    void ordinaryUserCannotListAdminVenues() throws Exception {
        assertError(call("/api/v1/admin/venues", user("zhangsan", Role.USER), Role.USER), ErrorCode.FORBIDDEN);
    }
}
