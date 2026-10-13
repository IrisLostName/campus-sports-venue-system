package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * P1、P2、V2（ACC-M3-02）：角色由方法级注解检查；阶段顺序为 认证 → 格式（VALIDATION_ERROR）→ 角色（FORBIDDEN）；
 * 方法级拒绝与认证异常经 MVC 异常处理映射为 ErrorBody；当前用户只取自安全上下文。
 */
class RoleAndPhaseOrderTest extends AbstractApiTest {

    private static final String SYS_ADMIN_PROBE = "/api/v1/probe/sys-admin";
    private static final String INVALID_BODY = "{\"name\":\"\"}";
    private static final String VALID_BODY = "{\"name\":\"ok\"}";

    private MvcResult send(MockHttpServletRequestBuilder request, String authorization) throws Exception {
        if (authorization != null) {
            request.header(HttpHeaders.AUTHORIZATION, authorization);
        }
        return mockMvc.perform(request).andReturn();
    }

    private static MockHttpServletRequestBuilder postBody(String body) {
        return post(SYS_ADMIN_PROBE).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    @Test
    void roleAnnotationRejectsOtherRolesWithForbidden() throws Exception {
        String user = bearer(user("zhangsan", Role.USER), Role.USER);
        String venueAdmin = bearer(user("admin_tennis", Role.VENUE_ADMIN), Role.VENUE_ADMIN);
        String sysAdmin = bearer(user("sysadmin", Role.SYS_ADMIN), Role.SYS_ADMIN);

        assertError(send(get(SYS_ADMIN_PROBE), user), ErrorCode.FORBIDDEN);
        assertError(send(get(SYS_ADMIN_PROBE), venueAdmin), ErrorCode.FORBIDDEN);
        MvcResult allowed = send(get(SYS_ADMIN_PROBE), sysAdmin);
        assertThat(allowed.getResponse().getStatus()).isEqualTo(200);
        assertThat(allowed.getResponse().getContentAsString()).isEqualTo("ok");
    }

    /** 带有效令牌但角色不符、且请求体非法：VALIDATION_ERROR，而不是 FORBIDDEN。 */
    @Test
    void validationErrorComesBeforeForbidden() throws Exception {
        String user = bearer(user("zhangsan", Role.USER), Role.USER);

        MvcResult invalid = send(postBody(INVALID_BODY), user);
        assertThat(assertError(invalid, ErrorCode.VALIDATION_ERROR).get("details").get("fields").has("name")).isTrue();
        assertError(send(postBody(VALID_BODY), user), ErrorCode.FORBIDDEN);
    }

    /** 认证在最前：没有令牌或令牌过期时，即使请求体非法也先报认证错误。 */
    @Test
    void authenticationComesBeforeValidation() throws Exception {
        long id = user("zhangsan", Role.USER);
        String authorization = bearer(id, Role.USER);

        assertError(send(postBody(INVALID_BODY), null), ErrorCode.AUTH_REQUIRED);
        clock.setLocal(MutableClock.START.plusHours(8));
        assertError(send(postBody(INVALID_BODY), authorization), ErrorCode.TOKEN_EXPIRED);
    }

    /** P3：关闭 CSRF，带令牌的 POST 不需要 CSRF 令牌。 */
    @Test
    void sysAdminPostSucceedsWithoutCsrfToken() throws Exception {
        String sysAdmin = bearer(user("sysadmin", Role.SYS_ADMIN), Role.SYS_ADMIN);

        MvcResult result = send(postBody(VALID_BODY), sysAdmin);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).isEqualTo("ok");
    }

    @Test
    void securityExceptionsThrownInsideMvcMapToErrorBodies() throws Exception {
        String user = bearer(user("zhangsan", Role.USER), Role.USER);

        assertError(send(get("/api/v1/probe/access-denied"), user), ErrorCode.FORBIDDEN);
        assertError(send(get("/api/v1/probe/authentication-failed"), user), ErrorCode.AUTH_REQUIRED);
    }

    /** V2：当前用户只来自令牌，请求参数里的 userId 被忽略。 */
    @Test
    void currentUserComesFromTheTokenNotFromRequestParameters() throws Exception {
        long id = user("zhangsan", Role.USER);
        long other = user("lisi", Role.USER);

        MvcResult result = send(get("/api/v1/probe/current-user").param("userId", Long.toString(other)),
                bearer(id, Role.USER));

        assertThat(result.getResponse().getContentAsString()).isEqualTo(Long.toString(id));
    }
}
