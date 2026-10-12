package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** A4：POST /admin/venues（SA）：默认值、字段校验先于角色、重名 VALIDATION_ERROR fields.name。 */
class CreateVenueApiTest extends AbstractApiTest {

    private String sysAdminToken;

    @BeforeEach
    void seed() {
        sysAdminToken = bearer(user("sysadmin", Role.SYS_ADMIN), Role.SYS_ADMIN);
    }

    private MvcResult create(String token, Object body) throws Exception {
        return mockMvc.perform(post("/api/v1/admin/venues").header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))).andReturn();
    }

    private static Map<String, Object> body(String name, String venueType, String location, String description) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("venueType", venueType);
        body.put("location", location);
        body.put("description", description);
        return body;
    }

    private void assertField(MvcResult result, String field, String message) throws Exception {
        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get(field).asText()).isEqualTo(message);
    }

    @Test
    void sysAdminCreatesAnOpenVenueClosedToUsers() throws Exception {
        Map<String, Object> request = body("篮球馆", "BASKETBALL", "北区", "室内");
        request.put("operationalStatus", "CLOSED");
        request.put("userBookingEnabled", true);
        MvcResult result = create(sysAdminToken, request);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode created = json(result);
        assertThat(created.get("name").asText()).isEqualTo("篮球馆");
        assertThat(created.get("venueType").asText()).isEqualTo("BASKETBALL");
        assertThat(created.get("location").asText()).isEqualTo("北区");
        assertThat(created.get("description").asText()).isEqualTo("室内");
        assertThat(created.get("operationalStatus").asText()).isEqualTo("OPEN");
        assertThat(created.get("userBookingEnabled").asBoolean()).isFalse();
        assertThat(created.get("bookable").asBoolean()).isFalse();
        assertThat(created.get("resourceCount").asLong()).isZero();
        Map<String, Object> row = jdbc.queryForMap("select * from venue where id = ?", created.get("id").asLong());
        assertThat(row.get("operational_status")).isEqualTo("OPEN");
        assertThat(row.get("user_booking_enabled")).isEqualTo(false);
        assertThat(((Timestamp) row.get("created_at")).toLocalDateTime()).isEqualTo(MutableClock.START);
        assertThat(((Timestamp) row.get("updated_at")).toLocalDateTime()).isEqualTo(MutableClock.START);
        assertThat(jdbc.queryForObject("select count(*) from resource", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from availability_rule", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from admin_operation_log", Integer.class)).isZero();
    }

    @Test
    void blankOptionalFieldsAreStoredAsNullAndNameIsKeptAsIs() throws Exception {
        JsonNode created = json(create(sysAdminToken, body(" 篮球馆 ", "OTHER", "   ", "")));

        assertThat(created.get("name").asText()).isEqualTo(" 篮球馆 ");
        assertThat(created.get("location").isNull()).isTrue();
        assertThat(created.get("description").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from venue where location is null and description is null",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void maximumLengthsAreAccepted() throws Exception {
        MvcResult result = create(sysAdminToken, body("名".repeat(50), "TENNIS", "址".repeat(100), "述".repeat(500)));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void eachFieldIsValidated() throws Exception {
        assertField(create(sysAdminToken, body(null, "TENNIS", null, null)), "name", "必填");
        assertField(create(sysAdminToken, body("  ", "TENNIS", null, null)), "name", "必填");
        assertField(create(sysAdminToken, body("名".repeat(51), "TENNIS", null, null)), "name", "不能超过 50 个字符");
        assertField(create(sysAdminToken, body("篮球馆", null, null, null)), "venueType", "必填");
        assertField(create(sysAdminToken, body("篮球馆", "GOLF", null, null)), "venueType",
                "须为 TENNIS、BADMINTON、SWIMMING、BASKETBALL 或 OTHER");
        assertField(create(sysAdminToken, body("篮球馆", "OTHER", "址".repeat(101), null)), "location",
                "不能超过 100 个字符");
        assertField(create(sysAdminToken, body("篮球馆", "OTHER", null, "述".repeat(501))), "description",
                "不能超过 500 个字符");
        assertThat(jdbc.queryForObject("select count(*) from venue", Integer.class)).isZero();
    }

    @Test
    void validationComesBeforeTheRoleCheck() throws Exception {
        String userToken = bearer(user("zhangsan", Role.USER), Role.USER);

        assertField(create(userToken, body("", "TENNIS", null, null)), "name", "必填");
    }

    @Test
    void onlySysAdminMayCreate() throws Exception {
        String userToken = bearer(user("zhangsan", Role.USER), Role.USER);
        String adminToken = bearer(user("admin_tennis", Role.VENUE_ADMIN), Role.VENUE_ADMIN);

        assertError(create(userToken, body("篮球馆", "OTHER", null, null)), ErrorCode.FORBIDDEN);
        assertError(create(adminToken, body("篮球馆", "OTHER", null, null)), ErrorCode.FORBIDDEN);
        assertThat(jdbc.queryForObject("select count(*) from venue", Integer.class)).isZero();
    }

    @Test
    void duplicateNameIsAValidationErrorOnName() throws Exception {
        create(sysAdminToken, body("篮球馆", "OTHER", null, null));

        assertField(create(sysAdminToken, body("篮球馆", "TENNIS", null, null)), "name", "场馆名已存在");
        assertThat(jdbc.queryForObject("select count(*) from venue", Integer.class)).isEqualTo(1);
    }
}
