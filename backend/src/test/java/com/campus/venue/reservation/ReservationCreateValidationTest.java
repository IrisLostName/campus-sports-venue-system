package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.regex.Matcher;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-03（第 1 步与格式阶段）：认证 → 格式 VALIDATION_ERROR → 角色 USER（FORBIDDEN）→ 第 2–8 步（BE-3 C1、C2）。
 * 日期、时刻严格解析（BE-3 裁决第 12 节）；字段类型错误指明字段；JSON 语法错误为不带 details 的 400。
 */
@DisplayName("ACC-M3-03 创建预约：认证、格式与角色")
class ReservationCreateValidationTest extends ReservationApiTestBase {

    private JsonNode fields(MvcResult result) throws Exception {
        return assertError(result, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
    }

    private MvcResult createRaw(String json) throws Exception {
        return create(userBearer(zhangsan), json);
    }

    private String withField(String name, String rawValue) {
        String base = "\"resourceId\":" + court1 + ",\"serviceDate\":\"" + TOMORROW + "\",\"startTime\":\"09:30\"";
        return "{" + base.replaceFirst("\"" + name + "\":(\"[^\"]*\"|\\d+)", Matcher.quoteReplacement("\"" + name + "\":" + rawValue)) + "}";
    }

    @Test
    void unauthenticatedRequestIsRejectedFirst() throws Exception {
        MvcResult result = mockMvc.perform(post(RESERVATIONS).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn();

        assertError(result, ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void missingFieldsAreNamed() throws Exception {
        JsonNode fields = fields(createRaw("{}"));

        assertThat(fields.get("resourceId").asText()).isEqualTo("必填");
        assertThat(fields.get("serviceDate").asText()).isEqualTo("必填");
        assertThat(fields.get("startTime").asText()).isEqualTo("必填");
        assertThat(fields.has("purpose")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1"})
    void nonPositiveResourceIdIsRejected(String value) throws Exception {
        assertThat(fields(createRaw(withField("resourceId", value))).get("resourceId").asText()).isEqualTo("应为正整数");
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"abc\"", "1.5", "true"})
    void nonIntegerResourceIdIsRejectedNamingTheField(String value) throws Exception {
        assertThat(fields(createRaw(withField("resourceId", value))).get("resourceId").asText()).isEqualTo("类型不符");
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-02-30", "2026-1-5", "2026/10/13", "", "2026-10-13T09:30:00"})
    void invalidServiceDateIsRejectedNamingTheField(String value) throws Exception {
        assertThat(fields(createRaw(withField("serviceDate", "\"" + value + "\""))).has("serviceDate")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"24:00", "8:00", "09:30:00", "9.30", "25:00"})
    void invalidStartTimeIsRejectedNamingTheField(String value) throws Exception {
        assertThat(fields(createRaw(withField("startTime", "\"" + value + "\""))).get("startTime").asText())
                .isEqualTo("类型不符");
    }

    @Test
    void purposeLongerThan200CharactersIsRejected() throws Exception {
        String tooLong = "{" + body(court1, TOMORROW, "09:30").substring(1, body(court1, TOMORROW, "09:30").length() - 1)
                + ",\"purpose\":\"" + "球".repeat(201) + "\"}";
        String longest = tooLong.replace("球".repeat(201), "球".repeat(200));

        assertThat(fields(createRaw(tooLong)).get("purpose").asText()).isEqualTo("不能超过 200 个字符");
        assertThat(createRaw(longest).getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void nulInPurposeIsRejected() throws Exception {
        String json = withField("resourceId", court1 + ",\"purpose\":\"a\\u0000\"");

        assertThat(fields(createRaw(json)).get("purpose").asText()).isEqualTo("不能包含 U+0000 字符");
    }

    @Test
    void syntaxErrorAndMissingBodyCarryNoDetails() throws Exception {
        assertThat(assertError(createRaw("{\"resourceId\":"), ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
        assertThat(assertError(createRaw(""), ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
    }

    @Test
    void formatIsCheckedBeforeRole() throws Exception {
        long admin = user("sysadmin", Role.SYS_ADMIN);

        assertThat(fields(create(bearer(admin, Role.SYS_ADMIN), "{}")).has("resourceId")).isTrue();
    }

    @Test
    void adminsAreForbidden() throws Exception {
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        fixtures.grant(venueAdmin, tennis, sysAdmin);

        assertError(create(bearer(venueAdmin, Role.VENUE_ADMIN), body(court1, TOMORROW, "09:30")),
                ErrorCode.FORBIDDEN);
        assertError(create(bearer(sysAdmin, Role.SYS_ADMIN), body(court1, TOMORROW, "09:30")),
                ErrorCode.FORBIDDEN);
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isZero();
    }
}
