package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/** A3、V2：GET /auth/me 返回当前用户；venueIds 仅 VENUE_ADMIN 返回当前有效授权（升序），其他角色为 null。 */
class MeTest extends AbstractApiTest {

    private static final String ME = "/api/v1/auth/me";
    private static final LocalDate TODAY = MutableClock.START.toLocalDate();

    private MvcResult me(String authorization) throws Exception {
        return mockMvc.perform(get(ME).header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    private long venue(String name) {
        return jdbc.queryForObject("insert into venue (name, venue_type) values (?, 'OTHER') returning id",
                Long.class, name);
    }

    private void grant(long adminId, long venueId, String status, LocalDate from, LocalDate to, long grantedBy) {
        jdbc.update("insert into admin_venue_scope (admin_id, venue_id, status, valid_from, valid_to, granted_by)"
                + " values (?, ?, ?, ?, ?, ?)", adminId, venueId, status, from, to, grantedBy);
    }

    @Test
    void userProfileHasNullVenueIdsAndNullPhone() throws Exception {
        long id = user("zhangsan", Role.USER);

        MvcResult result = me(bearer(id, Role.USER));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("id").asLong()).isEqualTo(id);
        assertThat(body.get("username").asText()).isEqualTo("zhangsan");
        assertThat(body.get("displayName").asText()).isEqualTo("用户zhangsan");
        assertThat(body.get("role").asText()).isEqualTo("USER");
        assertThat(body.get("userType").asText()).isEqualTo("STUDENT");
        assertThat(body.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.has("phone")).isTrue();
        assertThat(body.get("phone").isNull()).isTrue();
        assertThat(body.has("venueIds")).isTrue();
        assertThat(body.get("venueIds").isNull()).isTrue();
    }

    @Test
    void sysAdminHasNullVenueIds() throws Exception {
        long id = user("sysadmin", Role.SYS_ADMIN);

        assertThat(json(me(bearer(id, Role.SYS_ADMIN))).get("venueIds").isNull()).isTrue();
    }

    /** 只列当前有效授权：撤销、有效期外的不列；其他管理员的授权不列；升序。 */
    @Test
    void venueAdminListsOnlyEffectiveScopesAscending() throws Exception {
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        long admin = user("admin_pool", Role.VENUE_ADMIN);
        long other = user("admin_tennis", Role.VENUE_ADMIN);
        long v1 = venue("一号馆");
        long v2 = venue("二号馆");
        long v3 = venue("三号馆");
        long v4 = venue("四号馆");
        grant(admin, v3, "ACTIVE", null, null, sysAdmin);
        grant(admin, v1, "ACTIVE", TODAY, TODAY, sysAdmin);
        grant(admin, v2, "REVOKED", null, null, sysAdmin);
        grant(admin, v4, "ACTIVE", TODAY.plusDays(1), null, sysAdmin);
        grant(other, v2, "ACTIVE", null, null, sysAdmin);

        JsonNode venueIds = json(me(bearer(admin, Role.VENUE_ADMIN))).get("venueIds");

        assertThat(venueIds.isArray()).isTrue();
        assertThat(venueIds).extracting(JsonNode::asLong).containsExactly(v1, v3);
    }

    @Test
    void venueAdminWithoutScopesGetsAnEmptyList() throws Exception {
        long admin = user("admin_new", Role.VENUE_ADMIN);

        JsonNode venueIds = json(me(bearer(admin, Role.VENUE_ADMIN))).get("venueIds");

        assertThat(venueIds.isArray()).isTrue();
        assertThat(venueIds).isEmpty();
    }

    /** V2：查询参数里的 userId 被忽略。 */
    @Test
    void userIdParameterIsIgnored() throws Exception {
        long id = user("zhangsan", Role.USER);
        long other = user("lisi", Role.USER);

        MvcResult result = mockMvc.perform(get(ME).param("userId", Long.toString(other))
                .header(HttpHeaders.AUTHORIZATION, bearer(id, Role.USER))).andReturn();

        assertThat(json(result).get("username").asText()).isEqualTo("zhangsan");
    }

    @Test
    void withoutTokenIsAuthRequired() throws Exception {
        assertError(mockMvc.perform(get(ME)).andReturn(), ErrorCode.AUTH_REQUIRED);
    }
}
