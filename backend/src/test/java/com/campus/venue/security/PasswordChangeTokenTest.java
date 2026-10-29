package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.auth.PasswordResetApiTestBase;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SEC-2b 裁决第 4 条与第 2 节“Token”：自助找回密码成功后，签发早于 password_changed_at（截到整秒）的令牌得 TOKEN_EXPIRED；
 * 重置后（含同一秒内）新登录的令牌有效；从未重置的账号不受影响；TOKEN_EXPIRED 先于 ACCOUNT_DISABLED（裁决 Q3）。
 */
class PasswordChangeTokenTest extends PasswordResetApiTestBase {

    private MvcResult call(String path, String bearer) throws Exception {
        return mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();
    }

    private String loginToken(String password) throws Exception {
        MvcResult login = login("zhangsan", password);
        assertThat(login.getResponse().getStatus()).isEqualTo(200);
        return "Bearer " + json(login).get("token").asText();
    }

    private void resetNow() throws Exception {
        assertThat(reset(correct("zhangsan")).getResponse().getStatus()).isEqualTo(204);
    }

    @Test
    @DisplayName("重置前签发的令牌之后访问任意需登录接口 → 401 TOKEN_EXPIRED")
    void tokenIssuedBeforeTheResetIsExpired() throws Exception {
        long id = student("zhangsan");
        String old = bearer(id, Role.USER);
        clock.advance(Duration.ofMinutes(5));

        resetNow();

        assertError(call("/api/v1/auth/me", old), ErrorCode.TOKEN_EXPIRED);
        assertError(call("/api/v1/reservations/me", old), ErrorCode.TOKEN_EXPIRED);
        assertError(call("/api/v1/repairs/me", old), ErrorCode.TOKEN_EXPIRED);
    }

    @Test
    @DisplayName("边界：签发于重置前一秒的令牌失效")
    void tokenIssuedOneSecondBeforeTheResetIsExpired() throws Exception {
        long id = student("zhangsan");
        String old = bearer(id, Role.USER);
        clock.advance(Duration.ofSeconds(1));

        resetNow();

        assertError(call("/api/v1/auth/me", old), ErrorCode.TOKEN_EXPIRED);
    }

    @Test
    @DisplayName("重置后同一秒内用新密码登录得到的令牌有效（iat 等于 password_changed_at）")
    void loginInTheSameSecondAsTheResetIsValid() throws Exception {
        student("zhangsan");
        clock.setLocal(MutableClock.START.plusNanos(100_000_000));
        resetNow();
        clock.setLocal(MutableClock.START.plusNanos(900_000_000));

        String fresh = loginToken(NEW_PASSWORD);

        assertThat(call("/api/v1/auth/me", fresh).getResponse().getStatus()).isEqualTo(200);
        assertThat(call("/api/v1/reservations/me", fresh).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("重置之后再晚些登录的令牌有效")
    void laterLoginIsValid() throws Exception {
        student("zhangsan");
        resetNow();
        clock.advance(Duration.ofHours(1));

        assertThat(call("/api/v1/auth/me", loginToken(NEW_PASSWORD)).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("已知取舍（裁决第 4 条）：同一秒内、重置之前签发的令牌仍有效（窗口不超过 1 秒）")
    void tokenIssuedEarlierInTheSameSecondStaysValid() throws Exception {
        long id = student("zhangsan");
        String sameSecond = bearer(id, Role.USER);
        clock.setLocal(MutableClock.START.plusNanos(500_000_000));

        resetNow();

        assertThat(call("/api/v1/auth/me", sameSecond).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("从未重置的账号不受影响；他人重置不影响自己的令牌")
    void accountsThatNeverResetAreUnaffected() throws Exception {
        student("zhangsan");
        long lisi = user("lisi", Role.USER);
        String lisiToken = bearer(lisi, Role.USER);
        clock.advance(Duration.ofMinutes(5));

        resetNow();

        assertThat(call("/api/v1/auth/me", lisiToken).getResponse().getStatus()).isEqualTo(200);
        assertThat(jdbc.queryForObject("select password_changed_at from app_user where id = ?", Object.class, lisi))
                .isNull();
    }

    @Test
    @DisplayName("重置后又被停用：旧令牌 TOKEN_EXPIRED（先于停用检查），新令牌 ACCOUNT_DISABLED")
    void expiryIsCheckedBeforeDisabled() throws Exception {
        long id = student("zhangsan");
        String old = bearer(id, Role.USER);
        clock.advance(Duration.ofMinutes(5));
        resetNow();
        String fresh = loginToken(NEW_PASSWORD);

        jdbc.update("update app_user set status = 'DISABLED' where id = ?", id);

        assertError(call("/api/v1/auth/me", old), ErrorCode.TOKEN_EXPIRED);
        assertError(call("/api/v1/auth/me", fresh), ErrorCode.ACCOUNT_DISABLED);
    }
}
