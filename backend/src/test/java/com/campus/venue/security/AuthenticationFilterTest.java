package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.TokenForgery;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/** J4、J5、P3：需登录接口的认证结果与错误码；每次请求按令牌中的用户 id 查库。 */
class AuthenticationFilterTest extends AbstractApiTest {

    private static final String PRINCIPAL = "/api/v1/probe/principal";

    private MvcResult call(String authorization) throws Exception {
        return mockMvc.perform(get(PRINCIPAL).header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    @Test
    void validTokenAuthenticatesTheUserFromTheDatabase() throws Exception {
        long id = user("zhangsan", Role.USER);

        MvcResult result = call(bearer(id, Role.USER));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("id").asLong()).isEqualTo(id);
        assertThat(body.get("username").asText()).isEqualTo("zhangsan");
        assertThat(body.get("role").asText()).isEqualTo("USER");
    }

    @Test
    void missingHeaderIsAuthRequired() throws Exception {
        assertError(mockMvc.perform(get(PRINCIPAL)).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void malformedHeadersAreAuthRequired() throws Exception {
        long id = user("zhangsan", Role.USER);
        String token = bearer(id, Role.USER).substring("Bearer ".length());

        assertError(call("Basic " + token), ErrorCode.AUTH_REQUIRED);
        assertError(call("Bearer "), ErrorCode.AUTH_REQUIRED);
        assertError(call("Bearer"), ErrorCode.AUTH_REQUIRED);
        assertError(call(token), ErrorCode.AUTH_REQUIRED);
        assertError(call("Bearer not-a-jwt"), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void schemeNameIsCaseInsensitive() throws Exception {
        long id = user("zhangsan", Role.USER);
        String token = bearer(id, Role.USER).substring("Bearer ".length());

        assertThat(call("bearer " + token).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void wrongSignatureIsAuthRequired() throws Exception {
        long id = user("zhangsan", Role.USER);
        Instant now = clock.instant();

        assertError(call("Bearer " + TokenForgery.signedWithOtherSecret(id, now, now.plusSeconds(3600))),
                ErrorCode.AUTH_REQUIRED);
        assertError(call("Bearer " + TokenForgery.tamperSignature(bearer(id, Role.USER).substring(7))),
                ErrorCode.AUTH_REQUIRED);
        assertError(call("Bearer " + TokenForgery.unsigned(id, now.plusSeconds(3600))), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void tokenOfADeletedUserIsAuthRequired() throws Exception {
        long id = user("zhangsan", Role.USER);
        String authorization = bearer(id, Role.USER);
        jdbc.update("delete from app_user where id = ?", id);

        assertError(call(authorization), ErrorCode.AUTH_REQUIRED);
    }

    /** 固定时钟推进到 exp 时刻正好过期；前一秒仍有效。 */
    @Test
    void tokenExpiresExactlyAtExp() throws Exception {
        long id = user("zhangsan", Role.USER);
        String authorization = bearer(id, Role.USER);

        clock.setLocal(MutableClock.START.plusHours(8).minusSeconds(1));
        assertThat(call(authorization).getResponse().getStatus()).isEqualTo(200);

        clock.setLocal(MutableClock.START.plusHours(8));
        assertError(call(authorization), ErrorCode.TOKEN_EXPIRED);
    }

    /** 停用立即生效：持有效令牌的用户被停用后，下一请求即 ACCOUNT_DISABLED；恢复后又可用。 */
    @Test
    void disablingAUserTakesEffectOnTheNextRequest() throws Exception {
        long id = user("zhangsan", Role.USER);
        String authorization = bearer(id, Role.USER);
        assertThat(call(authorization).getResponse().getStatus()).isEqualTo(200);

        jdbc.update("update app_user set status = 'DISABLED' where id = ?", id);
        assertError(call(authorization), ErrorCode.ACCOUNT_DISABLED);

        jdbc.update("update app_user set status = 'ACTIVE' where id = ?", id);
        assertThat(call(authorization).getResponse().getStatus()).isEqualTo(200);
    }

    /** 权限判断用库中的当前角色，不用令牌里的 role。 */
    @Test
    void authoritiesFollowTheCurrentDatabaseRole() throws Exception {
        long id = user("promoted", Role.USER);
        String authorization = bearer(id, Role.USER);
        jdbc.update("update app_user set role = 'SYS_ADMIN' where id = ?", id);

        assertThat(json(call(authorization)).get("role").asText()).isEqualTo("SYS_ADMIN");
        MvcResult adminOnly = mockMvc.perform(get("/api/v1/probe/sys-admin")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
        assertThat(adminOnly.getResponse().getStatus()).isEqualTo(200);

        jdbc.update("update app_user set role = 'USER' where id = ?", id);
        assertError(mockMvc.perform(get("/api/v1/probe/sys-admin")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn(), ErrorCode.FORBIDDEN);
    }

    /** P3：无状态，不建会话、不下发 Cookie。 */
    @Test
    void noSessionIsCreated() throws Exception {
        long id = user("zhangsan", Role.USER);

        MvcResult ok = call(bearer(id, Role.USER));
        MvcResult denied = mockMvc.perform(get(PRINCIPAL)).andReturn();

        for (MvcResult result : new MvcResult[] {ok, denied}) {
            assertThat(result.getRequest().getSession(false)).isNull();
            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        }
    }
}
