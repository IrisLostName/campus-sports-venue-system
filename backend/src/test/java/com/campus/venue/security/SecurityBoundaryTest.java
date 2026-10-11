package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.TokenForgery;
import com.campus.venue.user.domain.Role;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 安全边界：J6（公开接口完全忽略 Authorization 头）、P4 与裁决第 11 节（CORS，含错误响应的 CORS 头）、
 * 裁决第 11 节第 5 条（防火墙拒绝的请求返回 VALIDATION_ERROR）。
 */
class SecurityBoundaryTest extends AbstractApiTest {

    private static final String ALLOWED_ORIGIN = "http://localhost:5173";
    private static final String OTHER_ORIGIN = "http://evil.example";
    private static final String PROTECTED = "/api/v1/probe/principal";

    /** 过期、伪造、无签名、乱码、错误方案的 Authorization 头。 */
    private List<String> badAuthorizations() {
        long id = user("zhangsan", Role.USER);
        String expired = bearer(id, Role.USER);
        Instant now = clock.instant();
        clock.setLocal(MutableClock.START.plusHours(9));
        return List.of(expired,
                "Bearer " + TokenForgery.signedWithOtherSecret(id, now, now.plusSeconds(3600)),
                "Bearer " + TokenForgery.unsigned(id, now.plusSeconds(3600)),
                "Bearer not-a-jwt", "Basic abc");
    }

    @Test
    void healthIgnoresTheAuthorizationHeader() throws Exception {
        for (String authorization : badAuthorizations()) {
            MvcResult result = mockMvc.perform(get("/actuator/health")
                    .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();

            assertThat(result.getResponse().getStatus()).as(authorization).isEqualTo(200);
            assertThat(json(result).get("status").asText()).isEqualTo("UP");
        }
    }

    private static MockHttpServletRequestBuilder preflight(String origin) {
        return options(PROTECTED).header(HttpHeaders.ORIGIN, origin)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type");
    }

    @Test
    void preflightFromAnAllowedOriginNeedsNoToken() throws Exception {
        MvcResult result = mockMvc.perform(preflight(ALLOWED_ORIGIN)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isEqualTo(ALLOWED_ORIGIN);
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS))
                .containsIgnoringCase("authorization").containsIgnoringCase("content-type");
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS)).isNull();
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_MAX_AGE)).isEqualTo("3600");
    }

    @Test
    void preflightFromAnotherOriginIsRejected() throws Exception {
        MvcResult result = mockMvc.perform(preflight(OTHER_ORIGIN)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(403);
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isNull();
    }

    /** 入口点写出的 401（无令牌）也带 CORS 头，前端才能读到错误码。 */
    @Test
    void entryPointErrorCarriesCorsHeaders() throws Exception {
        MvcResult result = mockMvc.perform(get(PROTECTED).header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)).andReturn();

        assertError(result, ErrorCode.AUTH_REQUIRED);
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isEqualTo(ALLOWED_ORIGIN);
    }

    /** 过滤器直接写出的 401（过期令牌）与 403（账号停用）也带 CORS 头。 */
    @Test
    void filterErrorsCarryCorsHeaders() throws Exception {
        long id = user("zhangsan", Role.USER);
        String authorization = bearer(id, Role.USER);

        jdbc.update("update app_user set status = 'DISABLED' where id = ?", id);
        MvcResult disabled = mockMvc.perform(get(PROTECTED).header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
        assertError(disabled, ErrorCode.ACCOUNT_DISABLED);
        assertThat(disabled.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isEqualTo(ALLOWED_ORIGIN);

        clock.setLocal(MutableClock.START.plusHours(8));
        MvcResult expired = mockMvc.perform(get(PROTECTED).header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
        assertError(expired, ErrorCode.TOKEN_EXPIRED);
        assertThat(expired.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isEqualTo(ALLOWED_ORIGIN);
    }

    /** 方法级注解拒绝（MVC 写出的 403）同样带 CORS 头。 */
    @Test
    void forbiddenFromMvcCarriesCorsHeaders() throws Exception {
        String authorization = bearer(user("zhangsan", Role.USER), Role.USER);

        MvcResult result = mockMvc.perform(get("/api/v1/probe/sys-admin").header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();

        assertError(result, ErrorCode.FORBIDDEN);
        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isEqualTo(ALLOWED_ORIGIN);
    }

    @Test
    void responsesToOtherOriginsCarryNoAllowOrigin() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator/health").header(HttpHeaders.ORIGIN, OTHER_ORIGIN))
                .andReturn();

        assertThat(result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)).isNull();
    }

    /** StrictHttpFirewall 拒绝的请求（路径含分号）返回 400 VALIDATION_ERROR 的 ErrorBody。 */
    @Test
    void firewallRejectionIsValidationError() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/probe/principal;jsessionid=abc")).andReturn();

        assertThat(assertError(result, ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
    }
}
