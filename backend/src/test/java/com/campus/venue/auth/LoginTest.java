package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.TokenService;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MvcResult;

/** A2：登录校验（与前端 mock 一致）、INVALID_CREDENTIALS 不区分两种失败、先验口令后看状态、72 字节口令。 */
class LoginTest extends AbstractApiTest {

    private static final String LOGIN = "/api/v1/auth/login";

    @Autowired
    private JwtDecoder jwtDecoder;

    private MvcResult login(Object username, Object password) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", username);
        body.put("password", password);
        return mockMvc.perform(post(LOGIN).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    @Test
    void successReturnsTokenExpiryAndProfile() throws Exception {
        long id = user("zhangsan", Role.USER);

        MvcResult result = login("zhangsan", TestUsers.PASSWORD);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("user").get("id").asLong()).isEqualTo(id);
        assertThat(body.get("user").get("role").asText()).isEqualTo("USER");
        assertThat(body.get("user").get("venueIds").isNull()).isTrue();
        assertThat(body.get("expiresAt").asText()).isEqualTo("2026-10-12T16:30:15");
    }

    /** J3：expiresAt 与令牌 exp 是同一时刻（APP_TIMEZONE 本地时间）。 */
    @Test
    void expiresAtMatchesTheTokenExpiry() throws Exception {
        user("zhangsan", Role.USER);

        JsonNode body = json(login("zhangsan", TestUsers.PASSWORD));

        LocalDateTime exp = LocalDateTime.ofInstant(jwtDecoder.decode(body.get("token").asText()).getExpiresAt(),
                ZoneId.of("Asia/Shanghai"));
        assertThat(body.get("expiresAt").asText()).isEqualTo(exp.toString());
        assertThat(exp).isEqualTo(MutableClock.START.plusHours(8));
    }

    /** 用户不存在与口令错误返回完全相同的响应。 */
    @Test
    void unknownUserAndWrongPasswordAreIndistinguishable() throws Exception {
        user("zhangsan", Role.USER);

        MvcResult unknown = login("nobody", TestUsers.PASSWORD);
        MvcResult wrong = login("zhangsan", "Wrong@1234");
        MvcResult wrongCase = login("ZhangSan", TestUsers.PASSWORD);

        assertError(unknown, ErrorCode.INVALID_CREDENTIALS);
        assertError(wrong, ErrorCode.INVALID_CREDENTIALS);
        assertError(wrongCase, ErrorCode.INVALID_CREDENTIALS);
        assertThat(wrong.getResponse().getContentAsString()).isEqualTo(unknown.getResponse().getContentAsString());
    }

    /** 先验口令、后看状态：口令正确的停用账号 → ACCOUNT_DISABLED；口令错误的停用账号 → INVALID_CREDENTIALS。 */
    @Test
    void disabledAccountIsReportedOnlyAfterTheCorrectPassword() throws Exception {
        TestUsers.insert(jdbc, "frozen", Role.USER, AccountStatus.DISABLED);

        assertError(login("frozen", TestUsers.PASSWORD), ErrorCode.ACCOUNT_DISABLED);
        assertError(login("frozen", "Wrong@1234"), ErrorCode.INVALID_CREDENTIALS);
    }

    /** 超过 72 字节的口令（但不超过 64 个字符）：不调用编码器，直接 INVALID_CREDENTIALS。 */
    @Test
    void passwordOverSeventyTwoBytesIsInvalidCredentials() throws Exception {
        user("zhangsan", Role.USER);

        assertError(login("zhangsan", "密".repeat(25)), ErrorCode.INVALID_CREDENTIALS);
    }

    static List<Arguments> invalidBodies() {
        return List.of(
                Arguments.of("username", null, "x"),
                Arguments.of("username", "   ", "x"),
                Arguments.of("username", "u".repeat(33), "x"),
                Arguments.of("password", "zhangsan", null),
                Arguments.of("password", "zhangsan", ""),
                Arguments.of("password", "zhangsan", "p".repeat(65)));
    }

    /** 校验先于口令比对：不满足 → VALIDATION_ERROR，details.fields 指明字段。 */
    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidBodies")
    void invalidFieldsAreValidationErrors(String field, String username, String password) throws Exception {
        user("zhangsan", Role.USER);

        JsonNode error = assertError(login(username, password), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").has(field)).isTrue();
    }

    static List<Arguments> nulBodies() {
        return List.of(
                Arguments.of("username", "zhang\u0000san", TestUsers.PASSWORD),
                Arguments.of("password", "zhangsan", TestUsers.PASSWORD + "\u0000"));
    }

    /** F1：含 U+0000 的字段在反序列化时被拒绝 → VALIDATION_ERROR 并指明字段，不是 500。 */
    @ParameterizedTest(name = "{0}")
    @MethodSource("nulBodies")
    void nulCharacterIsValidationErrorNamingTheField(String field, String username, String password)
            throws Exception {
        user("zhangsan", Role.USER);

        JsonNode error = assertError(login(username, password), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").has(field)).isTrue();
    }

    /** 边界：32 位用户名与 64 位口令通过校验，进入口令比对。 */
    @Test
    void boundaryLengthsPassValidation() throws Exception {
        assertError(login("u".repeat(32), "p".repeat(64)), ErrorCode.INVALID_CREDENTIALS);
    }

    @Test
    void tokenFromLoginAuthenticatesLaterRequests(@Autowired TokenService tokens) throws Exception {
        long id = user("zhangsan", Role.USER);

        String token = json(login("zhangsan", TestUsers.PASSWORD)).get("token").asText();

        assertThat(tokens.verify(token)).isEqualTo(id);
    }
}
