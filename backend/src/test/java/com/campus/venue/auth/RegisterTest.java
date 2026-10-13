package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MvcResult;

/** A1（ACC-M3-02）：注册的成功响应、强制角色、原值保存、时间戳取 Clock、各字段校验与 USERNAME_TAKEN。 */
class RegisterTest extends AbstractApiTest {

    private static final String REGISTER = "/api/v1/auth/register";

    private static Map<String, Object> validBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", "new_user");
        body.put("password", "Passw0rd!");
        body.put("displayName", "新用户");
        return body;
    }

    private MvcResult register(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post(REGISTER).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    private Map<String, Object> row(String username) {
        return jdbc.queryForMap("select * from app_user where username = ?", username);
    }

    @Test
    void successReturns201WithTokenAndProfileIncludingNulls() throws Exception {
        MvcResult result = register(validBody());

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = json(result);
        assertThat(body.get("token").asText()).isNotBlank();
        assertThat(body.get("expiresAt").asText()).isEqualTo("2026-10-12T16:30:15");
        JsonNode user = body.get("user");
        List<String> keys = new ArrayList<>();
        user.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("id", "username", "displayName", "role", "userType", "phone", "status",
                "venueIds");
        assertThat(user.get("username").asText()).isEqualTo("new_user");
        assertThat(user.get("displayName").asText()).isEqualTo("新用户");
        assertThat(user.get("role").asText()).isEqualTo("USER");
        assertThat(user.get("userType").asText()).isEqualTo("STUDENT");
        assertThat(user.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(user.get("phone").isNull()).isTrue();
        assertThat(user.get("venueIds").isNull()).isTrue();
        assertThat(tokenService.verify(body.get("token").asText())).isEqualTo(user.get("id").asLong());
    }

    /** 时间戳取注入的 Clock（K2）；口令以 BCrypt 强度 10 存储。 */
    @Test
    void storesTimestampsFromTheClockAndABcryptHash() throws Exception {
        clock.setLocal(LocalDateTime.of(2026, 10, 13, 21, 5, 7));
        register(validBody());

        Map<String, Object> row = row("new_user");
        assertThat(row.get("created_at").toString()).isEqualTo("2026-10-13 21:05:07.0");
        assertThat(row.get("updated_at").toString()).isEqualTo("2026-10-13 21:05:07.0");
        String hash = (String) row.get("password_hash");
        assertThat(hash).startsWith("$2a$10$");
        assertThat(new BCryptPasswordEncoder().matches("Passw0rd!", hash)).isTrue();
    }

    /** 角色强制 USER；请求体中的 role、status 等字段被忽略；username、displayName 按原值保存。 */
    @Test
    void ignoresRoleAndStatusAndKeepsValuesAsReceived() throws Exception {
        Map<String, Object> body = validBody();
        body.put("displayName", "  李 雷  ");
        body.put("role", "SYS_ADMIN");
        body.put("status", "DISABLED");
        body.put("userType", "TEACHER");
        body.put("phone", "13800000000");

        MvcResult result = register(body);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        Map<String, Object> row = row("new_user");
        assertThat(row.get("role")).isEqualTo("USER");
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(row.get("display_name")).isEqualTo("  李 雷  ");
        assertThat(row.get("user_type")).isEqualTo("TEACHER");
        assertThat(row.get("phone")).isEqualTo("13800000000");
    }

    @Test
    void blankPhoneIsStoredAsNull() throws Exception {
        Map<String, Object> body = validBody();
        body.put("phone", "                         ");

        assertThat(register(body).getResponse().getStatus()).isEqualTo(201);
        assertThat(row("new_user").get("phone")).isNull();
    }

    @Test
    void duplicateUsernameIsUsernameTakenButUsernamesAreCaseSensitive() throws Exception {
        assertThat(register(validBody()).getResponse().getStatus()).isEqualTo(201);

        assertError(register(validBody()), ErrorCode.USERNAME_TAKEN);

        Map<String, Object> upper = validBody();
        upper.put("username", "NEW_USER");
        assertThat(register(upper).getResponse().getStatus()).isEqualTo(201);
        assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isEqualTo(2);
    }

    static List<Arguments> invalidFields() {
        return List.of(
                Arguments.of("username", null),
                Arguments.of("username", "ab"),
                Arguments.of("username", "a".repeat(33)),
                Arguments.of("username", "bad-name"),
                Arguments.of("username", "张三丰"),
                Arguments.of("password", null),
                Arguments.of("password", "1234567"),
                Arguments.of("password", "p".repeat(65)),
                Arguments.of("password", "密".repeat(25)),
                Arguments.of("displayName", null),
                Arguments.of("displayName", "   "),
                Arguments.of("displayName", "名".repeat(51)),
                Arguments.of("userType", "ADMIN"),
                Arguments.of("userType", "student"),
                Arguments.of("phone", "1".repeat(21)));
    }

    @ParameterizedTest(name = "{0} = {1}")
    @MethodSource("invalidFields")
    void invalidFieldIsValidationErrorNamingTheField(String field, Object value) throws Exception {
        Map<String, Object> body = validBody();
        body.put(field, value);

        JsonNode error = assertError(register(body), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").has(field)).as(field).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isZero();
    }

    /** F1：任一字符串字段含 U+0000 → VALIDATION_ERROR 并指明字段，不是 500，也不插入任何行。 */
    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"username", "displayName", "phone"})
    void nulCharacterIsValidationErrorNamingTheField(String field) throws Exception {
        Map<String, Object> body = validBody();
        body.put(field, "ab\u0000cd");

        JsonNode error = assertError(register(body), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").get(field).asText()).isEqualTo("不能包含 U+0000 字符");
        assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isZero();
    }

    /** F1 只拒绝 U+0000：换行与制表符原样反序列化并保存。 */
    @Test
    void newlinesAndTabsAreKeptUnchanged() throws Exception {
        Map<String, Object> body = validBody();
        body.put("displayName", "第一行\n第二行\t末尾");

        MvcResult result = register(body);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("user").get("displayName").asText()).isEqualTo("第一行\n第二行\t末尾");
        assertThat(row("new_user").get("display_name")).isEqualTo("第一行\n第二行\t末尾");
    }

    /** 边界值：用户名 3 与 32 位、口令 8 与 64 位、显示名 50 字、电话 20 位、72 字节口令都可注册。 */
    @Test
    void boundaryValuesAreAccepted() throws Exception {
        Map<String, Object> shortest = validBody();
        shortest.put("username", "abc");
        shortest.put("password", "12345678");
        shortest.put("phone", "1".repeat(20));
        assertThat(register(shortest).getResponse().getStatus()).isEqualTo(201);

        Map<String, Object> longest = validBody();
        longest.put("username", "u".repeat(32));
        longest.put("password", "密".repeat(24));
        longest.put("displayName", "名".repeat(50));
        assertThat(register(longest).getResponse().getStatus()).isEqualTo(201);

        Map<String, Object> ascii64 = validBody();
        ascii64.put("username", "ascii_64");
        ascii64.put("password", "p".repeat(64));
        assertThat(register(ascii64).getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    void registrationUsesTheFixedClockForTokenExpiry() throws Exception {
        clock.setLocal(MutableClock.START.plusMinutes(1));

        assertThat(json(register(validBody())).get("expiresAt").asText()).isEqualTo("2026-10-12T16:31:15");
    }
}
