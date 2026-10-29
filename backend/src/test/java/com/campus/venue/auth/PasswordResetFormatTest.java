package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** SEC-2b 裁决第 2 节“格式”：四个字段的空白、超长、手机号格式与新口令规则；格式错误不记录尝试、不改口令。 */
class PasswordResetFormatTest extends PasswordResetApiTestBase {

    static List<Arguments> invalidFields() {
        return List.of(
                Arguments.of("username", null, "必填"),
                Arguments.of("username", "   ", "必填"),
                Arguments.of("username", "u".repeat(33), "不能超过 32 个字符"),
                Arguments.of("displayName", null, "必填"),
                Arguments.of("displayName", "  ", "必填"),
                Arguments.of("displayName", "名".repeat(51), "不能超过 50 个字符"),
                Arguments.of("phone", null, "必填"),
                Arguments.of("phone", "  ", "必填"),
                Arguments.of("phone", "1380000000", "须为 11 位手机号"),
                Arguments.of("phone", "138000000000", "须为 11 位手机号"),
                Arguments.of("phone", "138 0000 0001", "须为 11 位手机号"),
                Arguments.of("phone", "138-0000-0001", "须为 11 位手机号"),
                Arguments.of("phone", "23800000001", "须为 11 位手机号"),
                Arguments.of("newPassword", null, "必填"),
                Arguments.of("newPassword", "1234567", "长度须为 8–64 位"),
                Arguments.of("newPassword", "p".repeat(65), "长度须为 8–64 位"),
                Arguments.of("newPassword", "密".repeat(25), "不能超过 72 字节"));
    }

    @ParameterizedTest(name = "{0} = {1}")
    @MethodSource("invalidFields")
    @DisplayName("字段不合法 → VALIDATION_ERROR，fields 只指明该字段；不记录尝试、不改口令")
    void invalidFieldIsValidationErrorAndNotCounted(String field, Object value, String message) throws Exception {
        long id = student("zhangsan");
        String hash = passwordHash(id);
        Map<String, Object> body = correct("zhangsan");
        body.put(field, value);

        JsonNode error = assertError(reset(body), ErrorCode.VALIDATION_ERROR);

        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.size()).isEqualTo(1);
        assertThat(fields.get(field).asText()).isEqualTo(message);
        assertThat(allAttempts()).isZero();
        assertThat(passwordHash(id)).isEqualTo(hash);
    }

    @Test
    @DisplayName("边界值：用户名 32 位、姓名 50 字、口令 8 与 64 位、72 字节口令格式通过（进入核对阶段）")
    void boundaryValuesPassTheFormatStage() throws Exception {
        List<Map<String, Object>> bodies = List.of(
                request("u".repeat(32), "名".repeat(50), PHONE, "12345678"),
                request("abc", NAME, PHONE, "p".repeat(64)),
                request("abc", NAME, PHONE, "密".repeat(24)));

        for (Map<String, Object> body : bodies) {
            assertError(reset(body), ErrorCode.RESET_INFO_MISMATCH);
        }
        assertThat(allAttempts()).isEqualTo(3);
    }

    @Test
    @DisplayName("全部字段缺失 → 四个字段都报“必填”")
    void emptyBodyNamesAllFourFields() throws Exception {
        JsonNode error = assertError(reset(Map.of()), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").properties()).extracting(Map.Entry::getKey)
                .containsExactlyInAnyOrder("username", "displayName", "phone", "newPassword");
    }
}
