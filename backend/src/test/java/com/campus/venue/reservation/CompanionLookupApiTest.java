package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * P2-2b：GET /users/lookup（docs/12 第 5.3 节，契约 v1.2）。精确匹配，先用户名、再手机号；只匹配 ACTIVE、USER、非本人；
 * 0 个或多于 1 个为 NOT_FOUND；返回体只有 userId 与 displayName。阶段顺序：认证 → 格式 → 角色 → 业务。
 */
@DisplayName("P2-2b 查找同行人")
class CompanionLookupApiTest extends ReservationApiTestBase {

    private static final String LOOKUP = "/api/v1/users/lookup";

    private MvcResult lookup(String authorization, String q) throws Exception {
        MockHttpServletRequestBuilder request = get(LOOKUP);
        if (authorization != null) {
            request.header(HttpHeaders.AUTHORIZATION, authorization);
        }
        if (q != null) {
            request.param("q", q);
        }
        return mockMvc.perform(request).andReturn();
    }

    private MvcResult asZhangsan(String q) throws Exception {
        return lookup(userBearer(zhangsan), q);
    }

    private void phone(long userId, String phone) {
        jdbc.update("update app_user set phone = ? where id = ?", phone, userId);
    }

    private JsonNode found(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json(result);
    }

    private void notFound(String q) throws Exception {
        assertError(asZhangsan(q), ErrorCode.NOT_FOUND);
    }

    private void invalidQ(MvcResult result) throws Exception {
        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").has("q")).isTrue();
    }

    @Test
    @DisplayName("按用户名精确匹配：返回体只有 userId 与 displayName")
    void exactUsernameReturnsOnlyIdAndDisplayName() throws Exception {
        phone(lisi, "13800000002");

        JsonNode body = found(asZhangsan("lisi"));

        List<String> keys = new ArrayList<>();
        body.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("userId", "displayName");
        assertThat(body.get("userId").asLong()).isEqualTo(lisi);
        assertThat(body.get("displayName").asText()).isEqualTo("用户lisi");
    }

    @Test
    @DisplayName("按手机号精确匹配")
    void exactPhone() throws Exception {
        phone(lisi, "13800000002");

        assertThat(found(asZhangsan("13800000002")).get("userId").asLong()).isEqualTo(lisi);
    }

    @Test
    @DisplayName("用户名优先于手机号：q 既是甲的用户名又是乙的手机号时返回甲")
    void usernameBeatsPhone() throws Exception {
        long numeric = user("13800000009", Role.USER);
        phone(lisi, "13800000009");

        assertThat(found(asZhangsan("13800000009")).get("userId").asLong()).isEqualTo(numeric);
    }

    @Test
    @DisplayName("用户名命中不合格用户（停用、管理员、本人）时继续按手机号匹配")
    void ineligibleUsernameFallsThroughToPhone() throws Exception {
        TestUsers.insert(jdbc, "13800000011", Role.USER, AccountStatus.DISABLED);
        user("13800000012", Role.VENUE_ADMIN);
        phone(lisi, "13800000011");
        long wangwu = user("wangwu", Role.USER);
        phone(wangwu, "13800000012");
        phone(zhangsan, "zhangsan");

        assertThat(found(asZhangsan("13800000011")).get("userId").asLong()).isEqualTo(lisi);
        assertThat(found(asZhangsan("13800000012")).get("userId").asLong()).isEqualTo(wangwu);
        phone(lisi, "zhangsan");
        assertThat(found(asZhangsan("zhangsan")).get("userId").asLong()).isEqualTo(lisi);
    }

    @Test
    @DisplayName("手机号被两个合格用户共用为 NOT_FOUND；只计合格用户（另一个停用时恰好一个）")
    void sharedPhoneCountsEligibleUsersOnly() throws Exception {
        long wangwu = user("wangwu", Role.USER);
        phone(lisi, "13800000003");
        phone(wangwu, "13800000003");
        notFound("13800000003");

        jdbc.update("update app_user set status = 'DISABLED' where id = ?", wangwu);
        assertThat(found(asZhangsan("13800000003")).get("userId").asLong()).isEqualTo(lisi);

        long admin = user("pool_admin", Role.VENUE_ADMIN);
        phone(admin, "13800000003");
        phone(zhangsan, "13800000003");
        assertThat(found(asZhangsan("13800000003")).get("userId").asLong()).isEqualTo(lisi);
    }

    @Test
    @DisplayName("停用用户、管理员账号、本人：用户名与手机号都得 NOT_FOUND")
    void ineligibleUsersAreNotFound() throws Exception {
        long disabled = TestUsers.insert(jdbc, "disabled_user", Role.USER, AccountStatus.DISABLED);
        long venueAdmin = user("venue_admin", Role.VENUE_ADMIN);
        long sysAdmin = user("sys_admin", Role.SYS_ADMIN);
        phone(disabled, "13800000004");
        phone(venueAdmin, "13800000005");
        phone(sysAdmin, "13800000006");
        phone(zhangsan, "13800000007");

        for (String q : List.of("disabled_user", "venue_admin", "sys_admin", "zhangsan",
                "13800000004", "13800000005", "13800000006", "13800000007")) {
            notFound(q);
        }
    }

    @Test
    @DisplayName("只做精确匹配：部分用户名、大小写不同、带首尾空白（不去空白）、不存在均为 NOT_FOUND")
    void onlyExactMatches() throws Exception {
        phone(lisi, "13800000008");

        for (String q : List.of("lis", "LISI", " lisi", "lisi ", "1380000000", "13800000008 ", "nobody")) {
            notFound(q);
        }
    }

    @Test
    @DisplayName("NOT_FOUND 的响应完全相同，不区分没有匹配、多人匹配与不合格")
    void notFoundResponsesAreIdentical() throws Exception {
        long wangwu = user("wangwu", Role.USER);
        phone(lisi, "13800000010");
        phone(wangwu, "13800000010");
        TestUsers.insert(jdbc, "disabled_user", Role.USER, AccountStatus.DISABLED);

        String none = asZhangsan("nobody").getResponse().getContentAsString();
        assertThat(asZhangsan("13800000010").getResponse().getContentAsString()).isEqualTo(none);
        assertThat(asZhangsan("disabled_user").getResponse().getContentAsString()).isEqualTo(none);
        assertThat(asZhangsan("zhangsan").getResponse().getContentAsString()).isEqualTo(none);
    }

    @Test
    @DisplayName("格式：缺少 q、空串、空白、超过 32 个字符为 VALIDATION_ERROR（fields.q）；正好 32 个字符通过格式")
    void malformedQIsValidationError() throws Exception {
        invalidQ(asZhangsan(null));
        invalidQ(asZhangsan(""));
        invalidQ(asZhangsan("   "));
        invalidQ(asZhangsan("a".repeat(33)));

        assertError(asZhangsan("a".repeat(32)), ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("角色：VA、SA 调用为 FORBIDDEN")
    void adminsAreForbidden() throws Exception {
        long venueAdmin = user("venue_admin", Role.VENUE_ADMIN);
        long sysAdmin = user("sys_admin", Role.SYS_ADMIN);

        assertError(lookup(bearer(venueAdmin, Role.VENUE_ADMIN), "lisi"), ErrorCode.FORBIDDEN);
        assertError(lookup(bearer(sysAdmin, Role.SYS_ADMIN), "lisi"), ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("阶段顺序：未登录 AUTH_REQUIRED 先于格式；格式先于角色（VA 传空白 q 得 VALIDATION_ERROR）")
    void phaseOrder() throws Exception {
        long venueAdmin = user("venue_admin", Role.VENUE_ADMIN);

        assertError(lookup(null, "   "), ErrorCode.AUTH_REQUIRED);
        assertError(lookup(null, "lisi"), ErrorCode.AUTH_REQUIRED);
        invalidQ(lookup(bearer(venueAdmin, Role.VENUE_ADMIN), "   "));
    }

    @Test
    @DisplayName("调用者账号已停用：ACCOUNT_DISABLED")
    void disabledCallerIsRejected() throws Exception {
        jdbc.update("update app_user set status = 'DISABLED' where id = ?", zhangsan);

        assertError(asZhangsan("lisi"), ErrorCode.ACCOUNT_DISABLED);
    }
}
