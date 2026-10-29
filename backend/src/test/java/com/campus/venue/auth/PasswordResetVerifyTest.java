package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MvcResult;

/** SEC-2b 裁决第 2 节“核对”：四项全对才重置；各种不合格账号与不存在的用户名表现完全一致；响应与日志不泄露信息。 */
@ExtendWith(OutputCaptureExtension.class)
class PasswordResetVerifyTest extends PasswordResetApiTestBase {

    @Test
    @DisplayName("四项全对 → 204 无响应体；密码已变；旧密码不能登录、新密码能登录；记一条成功；时刻截到整秒")
    void correctDetailsResetThePassword() throws Exception {
        clock.setLocal(LocalDateTime.of(2026, 10, 20, 9, 15, 30, 987_000_000));
        long id = student("zhangsan");

        MvcResult result = reset(correct("zhangsan"));

        assertThat(result.getResponse().getStatus()).isEqualTo(204);
        assertThat(result.getResponse().getContentAsString()).isEmpty();
        assertThat(new BCryptPasswordEncoder().matches(NEW_PASSWORD, passwordHash(id))).isTrue();
        assertError(login("zhangsan", TestUsers.PASSWORD), ErrorCode.INVALID_CREDENTIALS);
        assertThat(login("zhangsan", NEW_PASSWORD).getResponse().getStatus()).isEqualTo(200);
        Map<String, Object> row = jdbc.queryForMap("select * from app_user where id = ?", id);
        assertThat(row.get("password_changed_at").toString()).isEqualTo("2026-10-20 09:15:30.0");
        assertThat(row.get("updated_at").toString()).isEqualTo("2026-10-20 09:15:30.0");
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(attempts("zhangsan", true)).isEqualTo(1);
        assertThat(attempts("zhangsan", false)).isZero();
        assertThat(jdbc.queryForObject("select attempted_at from password_reset_attempt", LocalDateTime.class))
                .isEqualTo(LocalDateTime.of(2026, 10, 20, 9, 15, 30));
    }

    @Test
    @DisplayName("姓名或手机号差一个字、大小写或空白不同、管理员、停用、未登记手机号、不存在 → 一律 RESET_INFO_MISMATCH，"
            + "剩余次数同样递减（6、5…），口令不变")
    void everyIneligibleCaseLooksTheSame() throws Exception {
        long zhangsan = student("zhangsan");
        account("lisi", Role.USER, AccountStatus.ACTIVE, "Li Lei", PHONE);
        account("va", Role.VENUE_ADMIN, AccountStatus.ACTIVE, NAME, PHONE);
        account("sa", Role.SYS_ADMIN, AccountStatus.ACTIVE, NAME, PHONE);
        account("gone", Role.USER, AccountStatus.DISABLED, NAME, PHONE);
        account("nophone", Role.USER, AccountStatus.ACTIVE, NAME, null);
        String zhangsanHash = passwordHash(zhangsan);

        List<Map<String, Object>> sameUsername = List.of(
                request("zhangsan", "张四", PHONE, NEW_PASSWORD),
                request("zhangsan", NAME, "13800000002", NEW_PASSWORD),
                request("zhangsan", NAME + " ", PHONE, NEW_PASSWORD),
                request("ZHANGSAN", NAME, PHONE, NEW_PASSWORD));
        List<Map<String, Object>> otherAccounts = List.of(
                request("lisi", "li lei", PHONE, NEW_PASSWORD),
                correct("va"), correct("sa"), correct("gone"), correct("nophone"), correct("nobody"));

        assertThat(remainingSequence(sameUsername.subList(0, 3))).containsExactly(6, 5, 4);
        for (Map<String, Object> body : otherAccounts) {
            assertThat(remainingSequence(List.of(body, body))).as(body.get("username").toString())
                    .containsExactly(6, 5);
        }
        assertThat(remainingSequence(List.of(sameUsername.get(3)))).containsExactly(6);
        assertThat(passwordHash(zhangsan)).isEqualTo(zhangsanHash);
        assertThat(jdbc.queryForObject("select count(*) from app_user where password_changed_at is not null",
                Integer.class)).isZero();
    }

    @Test
    @DisplayName("失败行在错误响应之后仍保留（noRollbackFor，裁决 Q1）：每次 RESET_INFO_MISMATCH 都落一行 succeeded=false")
    void failureRowSurvivesTheErrorResponse() throws Exception {
        student("zhangsan");

        assertError(reset(wrong("zhangsan")), ErrorCode.RESET_INFO_MISMATCH);
        assertError(reset(wrong("nobody")), ErrorCode.RESET_INFO_MISMATCH);

        List<Map<String, Object>> rows = jdbc.queryForList(
                "select username, attempted_at, succeeded from password_reset_attempt order by id");
        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(row -> row.get("username")).containsExactly("zhangsan", "nobody");
        assertThat(rows).allSatisfy(row -> {
            assertThat(row.get("succeeded")).isEqualTo(false);
            assertThat(row.get("attempted_at").toString()).isEqualTo("2026-10-12 08:30:15.0");
        });
    }

    @Test
    @DisplayName("错误响应只有 code、message 与 details.remainingAttempts，不含任何账号信息")
    void mismatchBodyCarriesNoAccountInformation() throws Exception {
        student("zhangsan");

        JsonNode body = assertError(reset(wrong("zhangsan")), ErrorCode.RESET_INFO_MISMATCH);

        assertThat(fieldNames(body)).containsExactly("code", "message", "details");
        assertThat(fieldNames(body.get("details"))).containsExactly("remainingAttempts");
        assertThat(body.get("details").get("remainingAttempts").isInt()).isTrue();
        assertThat(body.toString()).doesNotContain("zhangsan", NAME, PHONE);
    }

    @Test
    @DisplayName("公开接口：不需要登录，忽略 Authorization 头（含无效令牌）")
    void publicEndpointIgnoresAuthorization() throws Exception {
        student("zhangsan");

        MvcResult result = mockMvc.perform(post(RESET).contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-token")
                .content(objectMapper.writeValueAsString(correct("zhangsan")))).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(204);
    }

    @Test
    @DisplayName("日志中不出现明文新密码与手机号（成功与失败两条路径）")
    void logsContainNeitherPasswordNorPhone(CapturedOutput output) throws Exception {
        student("zhangsan");

        reset(request("zhangsan", NAME, "13911112222", "Secret#Pass1"));
        reset(request("zhangsan", NAME, PHONE, "Secret#Pass2"));

        assertThat(output.getAll()).doesNotContain("Secret#Pass1", "Secret#Pass2", "13911112222", PHONE);
    }

    private List<Integer> remainingSequence(List<Map<String, Object>> bodies) throws Exception {
        List<Integer> remaining = new ArrayList<>();
        for (Map<String, Object> body : bodies) {
            JsonNode error = assertError(reset(body), ErrorCode.RESET_INFO_MISMATCH);
            remaining.add(error.get("details").get("remainingAttempts").asInt());
        }
        return remaining;
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }
}
