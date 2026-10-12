package com.campus.venue.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.servlet.HandlerMapping;

/**
 * BE-3 裁决 G4：查询参数与路径变量中的 U+0000 一律 400 VALIDATION_ERROR 并指明参数名；
 * 顺序为“认证 → 格式 → 角色”（未登录先得 AUTH_REQUIRED，低角色先得 VALIDATION_ERROR）。
 */
class NulParameterTest extends AbstractApiTest {

    private static final String ECHO = "/api/v1/probe/echo/abc";
    private static final String NUL = "a\u0000b";

    private String userBearer;

    @BeforeEach
    void createUser() {
        userBearer = bearer(user("zhangsan", Role.USER), Role.USER);
    }

    private JsonNode fieldsOf(MvcResult result) throws Exception {
        return assertError(result, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
    }

    @Test
    void nulInQueryParameterValueNamesTheParameter() throws Exception {
        MvcResult result = mockMvc.perform(get(ECHO).param("q", NUL)
                .header(HttpHeaders.AUTHORIZATION, userBearer)).andReturn();

        assertThat(fieldsOf(result).get("q").asText()).isEqualTo("不能包含 U+0000 字符");
    }

    /** 参数名含控制字符：StrictHttpFirewall 在首次读取参数表时拒绝，与防火墙拒绝一致为无 details 的 400，从不 500。 */
    @Test
    void nulInQueryParameterNameIsRejectedWithoutServerError() throws Exception {
        MvcResult result = mockMvc.perform(get(ECHO).param(NUL, "x")
                .header(HttpHeaders.AUTHORIZATION, userBearer)).andReturn();

        assertThat(assertError(result, ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
    }

    @Test
    void formatIsCheckedBeforeRole() throws Exception {
        // 探针要求 SYS_ADMIN：USER 携带合法参数得 FORBIDDEN，携带 U+0000 先得 VALIDATION_ERROR
        assertError(mockMvc.perform(get(ECHO).param("q", "ok")
                .header(HttpHeaders.AUTHORIZATION, userBearer)).andReturn(), ErrorCode.FORBIDDEN);
        assertThat(fieldsOf(mockMvc.perform(get(ECHO).param("q", NUL)
                .header(HttpHeaders.AUTHORIZATION, userBearer)).andReturn()).has("q")).isTrue();
    }

    @Test
    void authenticationIsCheckedBeforeFormat() throws Exception {
        assertError(mockMvc.perform(get(ECHO).param("q", NUL)).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void cleanParametersPassThrough() throws Exception {
        long admin = user("sysadmin", Role.SYS_ADMIN);
        MvcResult result = mockMvc.perform(get(ECHO).param("q", "1")
                .header(HttpHeaders.AUTHORIZATION, bearer(admin, Role.SYS_ADMIN))).andReturn();

        assertThat(result.getResponse().getContentAsString()).isEqualTo("abc1");
    }

    /** 路径中的 %00：被防火墙或拦截器拒绝，结果总是 400 VALIDATION_ERROR，从不 500。 */
    @Test
    void encodedNulInPathIsRejectedWithoutServerError() throws Exception {
        MvcResult result = mockMvc.perform(get(URI.create("/api/v1/probe/echo/a%00b"))
                .header(HttpHeaders.AUTHORIZATION, userBearer)).andReturn();

        assertThat(assertError(result, ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
    }

    @Test
    void nulInPathVariableNamesTheVariable() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/x");
        request.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("name", NUL));

        assertThatThrownBy(() -> new NulParameterInterceptor().preHandle(request, new MockHttpServletResponse(), null))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                    assertThat(ex.getDetails()).isEqualTo(Map.of("fields", Map.of("name", "不能包含 U+0000 字符")));
                });
    }

    @Test
    void cleanPathVariablesPass() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/x");
        request.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("name", "abc"));

        assertThat(new NulParameterInterceptor().preHandle(request, new MockHttpServletResponse(), null)).isTrue();
    }
}
