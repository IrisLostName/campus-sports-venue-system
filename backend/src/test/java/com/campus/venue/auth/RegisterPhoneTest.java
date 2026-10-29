package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** SEC-2b 裁决第 6 条（契约 v1.3）：注册的手机号必填，须为 11 位中国大陆手机号（^1\d{10}$）。 */
class RegisterPhoneTest extends AbstractApiTest {

    private MvcResult register(Object phone, boolean include) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", "new_user");
        body.put("password", "Passw0rd!");
        body.put("displayName", "新用户");
        if (include) {
            body.put("phone", phone);
        }
        return mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    private int userCount() {
        return jdbc.queryForObject("select count(*) from app_user", Integer.class);
    }

    @Test
    @DisplayName("缺少手机号或为 null → VALIDATION_ERROR fields.phone“必填”，不建账号")
    void missingPhoneIsRequired() throws Exception {
        for (MvcResult result : List.of(register(null, false), register(null, true))) {
            JsonNode error = assertError(result, ErrorCode.VALIDATION_ERROR);
            assertThat(error.get("details").get("fields").get("phone").asText()).isEqualTo("必填");
        }
        assertThat(userCount()).isZero();
    }

    @ParameterizedTest(name = "\"{0}\"")
    @ValueSource(strings = {"1380000000", "138000000000", "138 0000 0000", "138-0000-0000", " 13800000000",
        "13800000000 ", "23800000000", "+8613800000000", "１３８００００００００", "abcdefghijk"})
    @DisplayName("格式不对（10 位、12 位、含空格或短横线、不以 1 开头、全角数字）→ VALIDATION_ERROR fields.phone")
    void malformedPhoneIsValidationError(String phone) throws Exception {
        JsonNode error = assertError(register(phone, true), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").get("phone").asText()).isEqualTo("须为 11 位手机号");
        assertThat(userCount()).isZero();
    }

    @Test
    @DisplayName("正确格式 → 201，手机号按原值保存并返回")
    void wellFormedPhoneIsAccepted() throws Exception {
        MvcResult result = register("13800000000", true);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("user").get("phone").asText()).isEqualTo("13800000000");
        assertThat(jdbc.queryForObject("select phone from app_user where username = 'new_user'", String.class))
                .isEqualTo("13800000000");
    }
}
