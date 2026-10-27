package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-05：POST /admin/check-ins 扫码签到（docs/12 第 5.7 节、docs/10 第 4 节，契约 v1.1，P2-1b 裁决第 3 节“扫码”）。
 * 阶段顺序：认证 → 格式（VALIDATION_ERROR fields.code）→ 角色（VA、SA，否则 FORBIDDEN）→ 签到码（CHECKIN_CODE_INVALID）
 * → 范围（FORBIDDEN_SCOPE）→ INVALID_STATE（有效状态）→ CHECKIN_WINDOW_CLOSED（闭区间）→ ALREADY_CHECKED_IN。
 * 今天 09:30 的预约签到窗口为 [09:15, 09:45]。网球馆管理员只有网球馆的授权；羽毛球馆在其范围之外。
 */
@DisplayName("ACC-M3-05 扫码签到")
class AdminCheckInApiTest extends UsageApiTestBase {

    private long sysAdmin;
    private long tennisAdmin;
    private long badmintonCourt;

    @BeforeEach
    void seedAdmins() {
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        long badminton = fixtures.bookableVenue("羽毛球馆");
        badmintonCourt = fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");
        fixtures.weeklyEveryDay(badminton, "08:00", "20:00");
    }

    private String sys() {
        return bearer(sysAdmin, Role.SYS_ADMIN);
    }

    private String va() {
        return bearer(tennisAdmin, Role.VENUE_ADMIN);
    }

    private JsonNode scannedOk(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result);
    }

    private int logCount() {
        return jdbc.queryForObject("select count(*) from admin_operation_log", Integer.class);
    }

    private LocalDateTime checkInAt(long reservationId) {
        return jdbc.queryForObject("select check_in_at from usage_record where reservation_id = ?",
                LocalDateTime.class, reservationId);
    }

    @Test
    @DisplayName("ACC-M3-05 SA 扫码成功：写入使用记录（check_in_at 取时钟），返回含预约人信息的 AdminReservation，不写操作日志")
    void sysAdminChecksIn() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));

        JsonNode body = scannedOk(scan(sys(), codeOf(id)));

        assertThat(body.get("id").asLong()).isEqualTo(id);
        assertThat(body.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(body.get("checkInAt").asText()).isEqualTo("2026-10-12T09:20:00");
        assertThat(body.get("checkOutAt").isNull()).isTrue();
        assertThat(body.get("userUsername").asText()).isEqualTo("zhangsan");
        assertThat(body.has("userPhone")).isTrue();
        assertThat(body.get("userPhone").isNull()).isTrue();
        assertThat(checkInAt(id)).isEqualTo(today(9, 20, 0));
        assertThat(usageCount(id)).isEqualTo(1);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 VA 范围内扫码成功；范围外 FORBIDDEN_SCOPE（details.venueId），不写使用记录")
    void venueAdminIsLimitedToScope() throws Exception {
        long inScope = todaySlot(zhangsan);
        long outOfScope = fixtures.reservation(zhangsan, badmintonCourt, TODAY, SLOT, "CONFIRMED");
        long badminton = jdbc.queryForObject("select venue_id from resource where id = ?", Long.class,
                badmintonCourt);
        clock.setLocal(today(9, 20, 0));

        assertThat(scannedOk(scan(va(), codeOf(inScope))).get("displayStatus").asText()).isEqualTo("IN_USE");
        JsonNode error = assertError(scan(va(), codeOf(outOfScope)), ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertThat(usageCount(outOfScope)).isZero();
        assertThat(scannedOk(scan(sys(), codeOf(outOfScope))).get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 USER 调用为 FORBIDDEN（包括扫自己的有效码），不写使用记录")
    void userIsForbidden() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));

        assertError(scan(userBearer(zhangsan), codeOf(id)), ErrorCode.FORBIDDEN);
        assertError(scan(userBearer(lisi), codeOf(id)), ErrorCode.FORBIDDEN);
        assertThat(usageCount(id)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 格式：缺请求体、缺 code、null、空白、超过 100、格式不对、首尾空白均为 VALIDATION_ERROR")
    void malformedCodesAreValidationErrors() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));
        String valid = codeOf(id);

        JsonNode missingBody = assertError(scanBody(sys(), null), ErrorCode.VALIDATION_ERROR);
        assertThat(missingBody.path("details").path("fields").isMissingNode()).isTrue();
        for (String json : new String[] {"{}", "{\"code\":null}", "{\"code\":\"\"}", "{\"code\":\"   \"}",
            "{\"code\":\"" + "a".repeat(101) + "\"}", "{\"code\":\"" + valid + "x\"}",
            "{\"code\":\"" + valid.replace(".", "") + "\"}", "{\"code\":\" " + valid + "\"}",
            "{\"code\":\"" + valid.substring(0, valid.indexOf('.')) + ".0\"}", "{\"code\":\"" + id + "\"}"}) {
            JsonNode error = assertError(scanBody(sys(), json), ErrorCode.VALIDATION_ERROR);
            assertThat(error.get("details").get("fields").has("code")).as(json).isTrue();
        }
        assertThat(usageCount(id)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 大写十六进制的签到标识按 UUID 值比较，同样签到成功")
    void upperCaseCodeIsAccepted() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));

        assertThat(scannedOk(scan(sys(), codeOf(id).toUpperCase())).get("id").asLong()).isEqualTo(id);
    }

    @Test
    @DisplayName("ACC-M3-05 CHECKIN_CODE_INVALID：预约不存在、他人标识拼本人预约、本人标识拼他人预约、随机标识，响应完全相同")
    void unmatchedCodesAreIndistinguishable() throws Exception {
        long mine = todaySlot(zhangsan);
        long theirs = fixtures.reservation(lisi, court2, TODAY, SLOT, "CONFIRMED");
        clock.setLocal(today(9, 20, 0));
        String zhangsanUuid = checkInUuid(zhangsan).toString();
        String lisiUuid = checkInUuid(lisi).toString();

        String[] codes = {zhangsanUuid + ".999999", lisiUuid + "." + mine, zhangsanUuid + "." + theirs,
            UUID.randomUUID() + "." + mine};
        String first = null;
        for (String code : codes) {
            MvcResult result = scan(sys(), code);
            JsonNode error = assertError(result, ErrorCode.CHECKIN_CODE_INVALID);
            assertThat(error.has("details")).as(code).isFalse();
            String content = result.getResponse().getContentAsString();
            assertThat(content).as(code).isEqualTo(first == null ? content : first);
            first = content;
        }
        assertThat(jdbc.queryForObject("select count(*) from usage_record", Integer.class)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 阶段顺序：认证 → 格式 → 角色 → 签到码 → 范围 → 业务")
    void phaseOrder() throws Exception {
        long cancelledOutOfScope = fixtures.reservation(zhangsan, badmintonCourt, TODAY, SLOT, "CANCELLED");
        String wrongCode = checkInUuid(lisi) + "." + cancelledOutOfScope;
        clock.setLocal(today(9, 20, 0));

        assertError(mockMvc.perform(post(ADMIN_CHECK_INS).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"bad\"}")).andReturn(), ErrorCode.AUTH_REQUIRED);
        // 格式先于角色：USER 发格式错误的码得 VALIDATION_ERROR，发格式正确的码得 FORBIDDEN
        assertError(scan(userBearer(zhangsan), "bad"), ErrorCode.VALIDATION_ERROR);
        assertError(scan(userBearer(zhangsan), wrongCode), ErrorCode.FORBIDDEN);
        // 签到码先于范围：VA 范围外且码不匹配得 CHECKIN_CODE_INVALID
        assertError(scan(va(), wrongCode), ErrorCode.CHECKIN_CODE_INVALID);
        // 范围先于业务：VA 范围外、码正确、预约已取消得 FORBIDDEN_SCOPE
        assertError(scan(va(), codeOf(cancelledOutOfScope)), ErrorCode.FORBIDDEN_SCOPE);
        // SA 不受范围限制，走到业务检查
        assertThat(assertError(scan(sys(), codeOf(cancelledOutOfScope)), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("CANCELLED");
    }
}
