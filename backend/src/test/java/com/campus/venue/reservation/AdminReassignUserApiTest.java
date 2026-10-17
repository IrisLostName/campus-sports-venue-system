package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 A4、T2、T4、T6：POST /admin/reservations/{id}/reassign-user（docs/10 第 6 节）。目标用户不存在、角色不是 USER、
 * 账号不是 ACTIVE → USER_NOT_ELIGIBLE；不校验目标用户的持有上限；原行更新 user_id 与 admin_note，写 RESERVATION_REASSIGN_USER。
 * target：zhangsan 明天 09:30 的网球场1。
 */
class AdminReassignUserApiTest extends AdminReservationApiTestBase {

    private long target;

    @BeforeEach
    void seedTarget() {
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
    }

    private MvcResult reassign(long id, Object userId) throws Exception {
        return asSys(HttpMethod.POST, REASSIGN_USER, body("userId", userId, "reason", "代为预约"), id);
    }

    private void assertIneligible(MvcResult result) throws Exception {
        assertError(result, ErrorCode.USER_NOT_ELIGIBLE);
        assertThat(reservationRow(target).get("user_id")).isEqualTo(zhangsan);
        assertThat(reservationRow(target).get("admin_note")).isNull();
        assertThat(logCount()).isZero();
    }

    private JsonNode currentReservationsOf(long userId) throws Exception {
        return json(mockMvc.perform(get("/api/v1/reservations/me").param("scope", "CURRENT")
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, Role.USER))).andReturn()).get("items");
    }

    @Test
    @DisplayName("ACC-M3-06 改派给另一名 USER：原行更新 user_id、仍 CONFIRMED、adminNote 为原因、updated_at 取 Clock，写日志")
    void reassignsTheOwnerAndLogs() throws Exception {
        clock.advance(Duration.ofMinutes(1));

        JsonNode view = ok(asTennisAdmin(HttpMethod.POST, REASSIGN_USER,
                body("userId", lisi, "reason", "原预约人已离校"), target));

        assertThat(view.get("id").asLong()).isEqualTo(target);
        assertThat(view.get("userId").asLong()).isEqualTo(lisi);
        assertThat(view.get("userDisplayName").asText()).isEqualTo("用户lisi");
        assertThat(view.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(view.get("resourceId").asLong()).isEqualTo(court1);
        assertThat(view.get("adminNote").asText()).isEqualTo("原预约人已离校");
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("user_id")).isEqualTo(lisi);
        assertThat(row.get("status")).isEqualTo("CONFIRMED");
        assertThat(row.get("admin_note")).isEqualTo("原预约人已离校");
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW.plusMinutes(1)));

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RESERVATION_REASSIGN_USER");
        assertThat(log.get("target_type")).isEqualTo("RESERVATION");
        assertThat(log.get("target_id")).isEqualTo(target);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("reason")).isEqualTo("原预约人已离校");
        JsonNode before = snapshot(log, "before_snapshot");
        assertThat(before.get("object").get("userId").asLong()).isEqualTo(zhangsan);
        assertThat(before.get("object").get("userDisplayName").asText()).isEqualTo("用户zhangsan");
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(view);
        assertThat(ids(before.get("affectedReservationIds"))).containsExactly(target);
        assertThat(ids(snapshot(log, "after_snapshot").get("affectedReservationIds"))).containsExactly(target);
    }

    @Test
    @DisplayName("改派后新预约人在“我的预约”中可见、adminNote 为原因；原预约人不再看到")
    void newOwnerSeesTheReservation() throws Exception {
        ok(reassign(target, lisi));

        JsonNode mine = currentReservationsOf(lisi);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).get("id").asLong()).isEqualTo(target);
        assertThat(mine.get(0).get("adminNote").asText()).isEqualTo("代为预约");
        assertThat(currentReservationsOf(zhangsan)).isEmpty();
    }

    @Test
    @DisplayName("不校验目标用户的持有上限：已持有 3 个（上限）仍可改派，改派后持有 4 个")
    void bookingLimitIsNotChecked() throws Exception {
        for (String start : new String[] {"08:00", "11:00", "12:30"}) {
            reservation(lisi, court2, TOMORROW, start);
        }

        assertThat(ok(reassign(target, lisi)).get("userId").asLong()).isEqualTo(lisi);

        assertThat(currentReservationsOf(lisi)).hasSize(4);
    }

    @Test
    @DisplayName("目标用户不存在、角色为 VENUE_ADMIN / SYS_ADMIN、账号 DISABLED → USER_NOT_ELIGIBLE，不改预约、不写日志")
    void ineligibleTargetsAreRejected() throws Exception {
        long disabled = TestUsers.insert(jdbc, "wangwu", Role.USER, AccountStatus.DISABLED);

        assertIneligible(reassign(target, 999999));
        assertIneligible(reassign(target, tennisAdmin));
        assertIneligible(reassign(target, sysAdmin));
        assertIneligible(reassign(target, disabled));
    }

    @Test
    @DisplayName("改派给原预约人本人允许（与 mock 一致），adminNote 更新并写日志")
    void reassigningToTheSameOwnerIsAllowed() throws Exception {
        JsonNode view = ok(reassign(target, zhangsan));

        assertThat(view.get("userId").asLong()).isEqualTo(zhangsan);
        assertThat(view.get("adminNote").asText()).isEqualTo("代为预约");
        assertThat(onlyLog().get("action")).isEqualTo("RESERVATION_REASSIGN_USER");
    }

    @Test
    @DisplayName("已签到未结束 → ALREADY_CHECKED_IN（先于目标用户检查）")
    void checkedInReservationCannotBeReassigned() throws Exception {
        long inUse = reservation(zhangsan, court3, TODAY, "08:00");
        fixtures.usage(inUse, TODAY.atTime(7, 50), null);

        assertError(reassign(inUse, lisi), ErrorCode.ALREADY_CHECKED_IN);
        assertError(reassign(inUse, 999999), ErrorCode.ALREADY_CHECKED_IN);
        assertThat(reservationRow(inUse).get("user_id")).isEqualTo(zhangsan);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("字段格式：缺 userId 为“必填”，非数字为“类型不符”，非正为“应为正整数”")
    void malformedUserIdIsAValidationError() throws Exception {
        JsonNode missing = assertError(asSys(HttpMethod.POST, REASSIGN_USER, body("reason", "原因"), target),
                ErrorCode.VALIDATION_ERROR);
        assertThat(missing.get("details").get("fields").get("userId").asText()).isEqualTo("必填");
        JsonNode text = assertError(reassign(target, "abc"), ErrorCode.VALIDATION_ERROR);
        assertThat(text.get("details").get("fields").get("userId").asText()).isEqualTo("类型不符");
        JsonNode zero = assertError(reassign(target, 0), ErrorCode.VALIDATION_ERROR);
        assertThat(zero.get("details").get("fields").get("userId").asText()).isEqualTo("应为正整数");
        assertThat(logCount()).isZero();
    }
}
