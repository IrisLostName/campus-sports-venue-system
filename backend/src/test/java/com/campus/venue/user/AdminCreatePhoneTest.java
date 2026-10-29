package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SEC-2b 裁决第 6 条（契约 v1.3）：系统管理员创建 USER 账号时手机号必填；其他角色可不填（空白视为未填，存 NULL），
 * 填写时同样须为 11 位手机号。格式先于角色与 USERNAME_TAKEN。
 */
class AdminCreatePhoneTest extends AdminUserApiTestBase {

    private static Map<String, Object> withoutPhone(String username, String role) {
        Map<String, Object> account = newAccount(username, role);
        account.remove("phone");
        return account;
    }

    private int userCount() {
        return jdbc.queryForObject("select count(*) from app_user", Integer.class);
    }

    @Test
    @DisplayName("创建 USER 缺手机号、null 或空白 → VALIDATION_ERROR fields.phone“必填”，不写入、不写日志")
    void userWithoutPhoneFails() throws Exception {
        int before = userCount();
        Map<String, Object> blank = newAccount("u_blank", "USER");
        blank.put("phone", "  ");
        Map<String, Object> explicitNull = newAccount("u_null", "USER");
        explicitNull.put("phone", null);

        for (Map<String, Object> request : List.of(withoutPhone("u_missing", "USER"), blank, explicitNull)) {
            JsonNode error = assertError(createAsSys(request), ErrorCode.VALIDATION_ERROR);
            assertThat(fields(error).get("phone").asText()).isEqualTo("必填");
        }
        assertThat(userCount()).isEqualTo(before);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("创建 USER 缺手机号且用户名已占用 → VALIDATION_ERROR（格式先于 USERNAME_TAKEN）")
    void missingPhoneIsCheckedBeforeUsernameTaken() throws Exception {
        JsonNode error = assertError(createAsSys(withoutPhone("zhangsan", "USER")), ErrorCode.VALIDATION_ERROR);

        assertThat(fields(error).get("phone").asText()).isEqualTo("必填");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"VENUE_ADMIN", "SYS_ADMIN"})
    @DisplayName("创建管理员不填手机号 → 201，phone 为 null；空白同样视为未填")
    void adminsMayOmitThePhone(String role) throws Exception {
        MvcResult omitted = createAsSys(withoutPhone("adm_omit", role));
        Map<String, Object> blank = newAccount("adm_blank", role);
        blank.put("phone", " ");
        MvcResult blanked = createAsSys(blank);

        for (MvcResult result : List.of(omitted, blanked)) {
            assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(201);
            JsonNode created = json(result);
            assertThat(created.get("phone").isNull()).isTrue();
            assertThat(userRow(created.get("id").asLong()).get("phone")).isNull();
        }
    }

    @ParameterizedTest(name = "{0} \"{1}\"")
    @CsvSource({"USER,1380000000", "USER,138-0000-0000", "VENUE_ADMIN,138 0000 0000",
        "SYS_ADMIN,23800000000", "VENUE_ADMIN,138000000000"})
    @DisplayName("任一角色填写了格式不对的手机号 → VALIDATION_ERROR fields.phone")
    void malformedPhoneFailsForEveryRole(String role, String phone) throws Exception {
        Map<String, Object> request = newAccount("bad_phone", role);
        request.put("phone", phone);

        JsonNode error = assertError(createAsSys(request), ErrorCode.VALIDATION_ERROR);

        assertThat(fields(error).get("phone").asText()).isEqualTo("须为 11 位手机号");
        assertThat(fields(error).size()).isEqualTo(1);
    }

    @Test
    @DisplayName("创建 USER 带正确手机号 → 201，按原值保存")
    void userWithWellFormedPhoneIsCreated() throws Exception {
        MvcResult result = createAsSys(newAccount("u_ok", "USER"));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("phone").asText()).isEqualTo("13800000000");
    }
}
