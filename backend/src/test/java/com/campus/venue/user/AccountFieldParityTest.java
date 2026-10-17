package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-6 P1：注册（/auth/register）与创建账号（POST /admin/users）的字段约束共用一处，同一非法值得到同一字段文案。
 * 用例与 RegisterTest 的非法值一致，另加 U+0000。
 */
class AccountFieldParityTest extends AdminUserApiTestBase {

    static List<Arguments> invalidFields() {
        return List.of(
                Arguments.of("username", null),
                Arguments.of("username", "ab"),
                Arguments.of("username", "a".repeat(33)),
                Arguments.of("username", "bad-name"),
                Arguments.of("username", "张三丰"),
                Arguments.of("username", "ab\u0000cd"),
                Arguments.of("password", null),
                Arguments.of("password", "1234567"),
                Arguments.of("password", "p".repeat(65)),
                Arguments.of("password", "密".repeat(25)),
                Arguments.of("displayName", null),
                Arguments.of("displayName", "   "),
                Arguments.of("displayName", "名".repeat(51)),
                Arguments.of("displayName", "ab\u0000cd"),
                Arguments.of("userType", "ADMIN"),
                Arguments.of("userType", "student"),
                Arguments.of("phone", "1".repeat(21)),
                Arguments.of("phone", "ab\u0000cd"));
    }

    private MvcResult register(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    @ParameterizedTest(name = "{0} = {1}")
    @MethodSource("invalidFields")
    void registrationAndAdminCreationReportTheSameFieldMessage(String field, Object value) throws Exception {
        Map<String, Object> account = body("username", "same_name", "password", "Passw0rd!", "displayName", "名");
        account.put(field, value);

        JsonNode registered = assertError(register(account), ErrorCode.VALIDATION_ERROR);
        JsonNode created = assertError(asSys(HttpMethod.POST, USERS, merge(account, body("role", "USER"))),
                ErrorCode.VALIDATION_ERROR);

        String expected = fields(registered).get(field).asText();
        assertThat(expected).isNotBlank();
        assertThat(fields(created).get(field).asText()).isEqualTo(expected);
        assertThat(fields(created).size()).isEqualTo(fields(registered).size());
    }
}
