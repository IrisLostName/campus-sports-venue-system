package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-05：GET /reservations/{id}/check-in-code（docs/12 第 5.3 节，契约 v1.1，P2-1b 裁决第 3 节“签发”）。
 * 认证 → 格式 → 角色 USER → NOT_FOUND → NOT_OWNER → INVALID_STATE（有效状态）→ ALREADY_CHECKED_IN；不检查签到窗口。
 * 时钟 08:30:15，今天 09:30 的预约签到窗口 [09:15, 09:45] 尚未开启。
 */
@DisplayName("ACC-M3-05 签发签到码")
class CheckInCodeApiTest extends UsageApiTestBase {

    private JsonNode issuedOk(long userId, long id) throws Exception {
        MvcResult result = issueCode(userId, id);
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result);
    }

    @Test
    @DisplayName("ACC-M3-05 本人可出示的预约：签到窗口开始前即可签发，码为小写签到标识 + 预约 id，只有 code 一个字段")
    void issuesBeforeTheWindowOpens() throws Exception {
        long id = todaySlot(zhangsan);

        JsonNode body = issuedOk(zhangsan, id);

        List<String> keys = new ArrayList<>();
        body.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("code");
        assertThat(body.get("code").asText()).isEqualTo(checkInUuid(zhangsan).toString() + "." + id)
                .isEqualTo(codeOf(id)).isLowerCase().hasSizeLessThanOrEqualTo(100);
        assertThat(usageCount(id)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 同一预约两次签发得到同一个码；窗口内也可签发；同一用户的不同预约码不同")
    void theCodeIsFixed() throws Exception {
        long id = todaySlot(zhangsan);
        long other = fixtures.reservation(zhangsan, court2, TOMORROW, SLOT, "CONFIRMED");

        String first = issuedOk(zhangsan, id).get("code").asText();
        clock.setLocal(today(9, 45, 0));
        String second = issuedOk(zhangsan, id).get("code").asText();

        assertThat(second).isEqualTo(first);
        assertThat(issuedOk(zhangsan, other).get("code").asText()).isNotEqualTo(first);
    }

    @Test
    @DisplayName("ACC-M3-05 已签到（未结束）：ALREADY_CHECKED_IN")
    void checkedInIsAlreadyCheckedIn() throws Exception {
        long id = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));
        clock.setLocal(today(9, 50, 0));

        assertError(issueCode(zhangsan, id), ErrorCode.ALREADY_CHECKED_IN);
    }

    @Test
    @DisplayName("ACC-M3-05 INVALID_STATE：已取消、管理员取消、NO_SHOW、越过未到场判定点、已签到且已结束，details.status 为有效状态")
    void notShowableIsInvalidState() throws Exception {
        long cancelled = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "CANCELLED");
        long adminCancelled = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "ADMIN_CANCELLED");
        long noShow = fixtures.reservation(zhangsan, court2, TODAY, SLOT, "NO_SHOW");
        long overdue = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CONFIRMED");
        long ended = checkedIn(zhangsan, court2, TODAY, "06:30", today(6, 25, 0));

        assertThat(assertError(issueCode(zhangsan, cancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("CANCELLED");
        assertThat(assertError(issueCode(zhangsan, adminCancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(assertError(issueCode(zhangsan, noShow), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(assertError(issueCode(zhangsan, overdue), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(assertError(issueCode(zhangsan, ended), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("ACC-M3-05 认证 → 格式 → 角色（VA、SA 为 FORBIDDEN）→ NOT_FOUND → NOT_OWNER（先于状态）")
    void authenticationFormatRoleNotFoundThenNotOwner() throws Exception {
        long id = todaySlot(zhangsan);
        long cancelled = fixtures.reservation(zhangsan, court2, TODAY, SLOT, "CANCELLED");
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        fixtures.grant(venueAdmin, tennis, sysAdmin);

        assertError(mockMvc.perform(get(RESERVATIONS + "/{id}/check-in-code", id)).andReturn(),
                ErrorCode.AUTH_REQUIRED);
        assertError(issueCode(userBearer(zhangsan), "abc"), ErrorCode.VALIDATION_ERROR);
        assertError(issueCode(bearer(venueAdmin, Role.VENUE_ADMIN), "abc"), ErrorCode.VALIDATION_ERROR);
        assertError(issueCode(bearer(venueAdmin, Role.VENUE_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(issueCode(bearer(sysAdmin, Role.SYS_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(issueCode(zhangsan, 999_999), ErrorCode.NOT_FOUND);
        assertError(issueCode(lisi, id), ErrorCode.NOT_OWNER);
        assertError(issueCode(lisi, cancelled), ErrorCode.NOT_OWNER);
    }

    @Test
    @DisplayName("ACC-M3-05 签到标识不出现在其他接口的返回中（个人资料、我的预约、预约详情、管理端预约列表、管理端用户列表）")
    void checkInUuidIsNotExposedElsewhere() throws Exception {
        long id = todaySlot(zhangsan);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        String uuid = checkInUuid(zhangsan).toString();
        String sys = bearer(sysAdmin, Role.SYS_ADMIN);

        List<MvcResult> responses = List.of(
                mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, userBearer(zhangsan)))
                        .andReturn(),
                mockMvc.perform(get(RESERVATIONS + "/me").header(HttpHeaders.AUTHORIZATION, userBearer(zhangsan)))
                        .andReturn(),
                detail(userBearer(zhangsan), id),
                detail(sys, id),
                mockMvc.perform(get("/api/v1/admin/reservations").header(HttpHeaders.AUTHORIZATION, sys)).andReturn(),
                mockMvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, sys)).andReturn());

        for (MvcResult response : responses) {
            String content = response.getResponse().getContentAsString();
            assertThat(response.getResponse().getStatus()).as(content).isEqualTo(200);
            assertThat(content.toLowerCase()).contains("zhangsan").doesNotContain(uuid).doesNotContain("checkinuuid");
        }
    }
}
