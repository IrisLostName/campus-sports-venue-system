package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 A3、T2、T3、T6：POST /admin/reservations/{id}/reassign-resource（docs/10 第 6 节、docs/12 第 5.7 节）。
 * 目标检查顺序同 mock checkResourceTarget：场地不存在或跨场馆 / 非派生时段、场馆或场地非 OPEN、关闭规则 → SLOT_NOT_AVAILABLE
 * → SLOT_IN_PAST → SLOT_TAKEN（排除预约自身）；不受 advanceDays 与 userBookingEnabled 限制。
 * target：zhangsan 明天 09:30 的网球场1。
 */
class AdminReassignResourceApiTest extends AdminReservationApiTestBase {

    private long target;

    @BeforeEach
    void seedTarget() {
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
    }

    private MvcResult reassign(long id, long resourceId, LocalDate date, String start) throws Exception {
        return asSys(HttpMethod.POST, REASSIGN_RESOURCE, body("resourceId", resourceId,
                "serviceDate", date.toString(), "startTime", start, "reason", "场地调整"), id);
    }

    private void assertRejected(MvcResult result, ErrorCode code) throws Exception {
        assertError(result, code);
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("resource_id")).isEqualTo(court1);
        assertThat(row.get("start_time").toString()).isEqualTo("09:30:00");
        assertThat(row.get("admin_note")).isNull();
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("ACC-M3-06 改派到同场馆另一场地另一时段：原行更新、仍 CONFIRMED、adminNote 为原因、updated_at 取 Clock，写日志")
    void reassignsInPlaceAndLogs() throws Exception {
        clock.advance(Duration.ofMinutes(2));

        JsonNode view = ok(asTennisAdmin(HttpMethod.POST, REASSIGN_RESOURCE, body("resourceId", court2,
                "serviceDate", TOMORROW.plusDays(1).toString(), "startTime", "11:00", "reason", "网球场1维修"), target));

        assertThat(view.get("id").asLong()).isEqualTo(target);
        assertThat(view.get("resourceId").asLong()).isEqualTo(court2);
        assertThat(view.get("resourceName").asText()).isEqualTo("网球场2");
        assertThat(view.get("serviceDate").asText()).isEqualTo(TOMORROW.plusDays(1).toString());
        assertThat(view.get("startTime").asText()).isEqualTo("11:00");
        assertThat(view.get("endTime").asText()).isEqualTo("12:30");
        assertThat(view.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(view.get("userId").asLong()).isEqualTo(zhangsan);
        assertThat(view.get("adminNote").asText()).isEqualTo("网球场1维修");
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("resource_id")).isEqualTo(court2);
        assertThat(row.get("end_time").toString()).isEqualTo("12:30:00");
        assertThat(row.get("status")).isEqualTo("CONFIRMED");
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW.plusMinutes(2)));
        assertThat(row.get("cancelled_at")).isNull();

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RESERVATION_REASSIGN_RESOURCE");
        assertThat(log.get("target_type")).isEqualTo("RESERVATION");
        assertThat(log.get("target_id")).isEqualTo(target);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("reason")).isEqualTo("网球场1维修");
        JsonNode before = snapshot(log, "before_snapshot");
        assertThat(before.get("object").get("resourceId").asLong()).isEqualTo(court1);
        assertThat(before.get("object").get("startTime").asText()).isEqualTo("09:30");
        assertThat(before.get("object").get("adminNote").isNull()).isTrue();
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(view);
        assertThat(ids(before.get("affectedReservationIds"))).containsExactly(target);
        assertThat(ids(snapshot(log, "after_snapshot").get("affectedReservationIds"))).containsExactly(target);
    }

    @Test
    @DisplayName("目标场地不属于原预约所在场馆或不存在 → SLOT_NOT_AVAILABLE")
    void crossVenueOrUnknownResourceIsNotAvailable() throws Exception {
        assertRejected(reassign(target, badmintonCourt, TOMORROW, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertRejected(reassign(target, 999999, TOMORROW, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("非派生时段（不在 90 分钟网格上、在开放窗口外）→ SLOT_NOT_AVAILABLE；先于 SLOT_IN_PAST")
    void nonDerivedSlotIsNotAvailable() throws Exception {
        assertRejected(reassign(target, court2, TOMORROW, "10:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertRejected(reassign(target, court2, TOMORROW, "20:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertRejected(reassign(target, court2, TODAY.minusDays(1), "10:00"), ErrorCode.SLOT_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("场馆 CLOSED、目标场地 MAINTENANCE / DISABLED → SLOT_NOT_AVAILABLE")
    void closedVenueOrUnavailableResourceIsNotAvailable() throws Exception {
        jdbc.update("update resource set operational_status = 'MAINTENANCE' where id = ?", court2);
        jdbc.update("update resource set operational_status = 'DISABLED' where id = ?", court3);
        assertRejected(reassign(target, court2, TOMORROW, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertRejected(reassign(target, court3, TOMORROW, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);

        jdbc.update("update venue set operational_status = 'CLOSED' where id = ?", tennis);
        assertRejected(reassign(target, court4, TOMORROW, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("关闭规则：整馆关闭与只关闭目标场地 → SLOT_NOT_AVAILABLE；只关闭其他场地不影响；已停用的关闭不生效")
    void closuresMakeTheSlotNotAvailable() throws Exception {
        LocalDate date = TOMORROW.plusDays(1);
        fixtures.closure(tennis, court2, date, date);
        long wholeVenue = fixtures.closure(tennis, null, TOMORROW.plusDays(2), TOMORROW.plusDays(3));

        assertRejected(reassign(target, court2, date, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertRejected(reassign(target, court3, TOMORROW.plusDays(3), "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        fixtures.deactivateRule(wholeVenue);
        assertThat(ok(reassign(target, court3, TOMORROW.plusDays(3), "11:00")).get("resourceId").asLong())
                .isEqualTo(court3);
        assertThat(ok(reassign(target, court3, date, "11:00")).get("serviceDate").asText())
                .isEqualTo(date.toString());
    }

    @Test
    @DisplayName("超出 advanceDays 仍可改派；场馆 userBookingEnabled=false 仍可改派")
    void advanceDaysAndUserBookingDoNotApply() throws Exception {
        LocalDate farAway = TODAY.plusDays(30);
        assertThat(ok(reassign(target, court2, farAway, "08:00")).get("serviceDate").asText())
                .isEqualTo(farAway.toString());

        jdbc.update("update venue set user_booking_enabled = false where id = ?", tennis);
        assertThat(ok(reassign(target, court3, TOMORROW, "14:00")).get("resourceId").asLong()).isEqualTo(court3);
        assertThat(logCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("开始时刻正好等于现在 → SLOT_IN_PAST；已过去的派生时段同样")
    void startingNowIsInThePast() throws Exception {
        clock.setLocal(TOMORROW.atTime(8, 0));

        assertRejected(reassign(target, court2, TOMORROW, "08:00"), ErrorCode.SLOT_IN_PAST);
        assertRejected(reassign(target, court2, TODAY, "17:00"), ErrorCode.SLOT_IN_PAST);
        clock.setLocal(TOMORROW.atTime(7, 59, 59));
        assertThat(ok(reassign(target, court2, TOMORROW, "08:00")).get("startTime").asText()).isEqualTo("08:00");
    }

    @Test
    @DisplayName("目标时段已有其他有效预约（含已落库 NO_SHOW）→ SLOT_TAKEN；被取消的不占用")
    void occupiedTargetIsTaken() throws Exception {
        reservation(lisi, court2, TOMORROW, "11:00");
        fixtures.reservation(lisi, court3, TOMORROW, "11:00", "NO_SHOW");
        fixtures.reservation(lisi, court4, TOMORROW, "11:00", "CANCELLED");
        fixtures.reservation(lisi, court4, TOMORROW, "11:00", "ADMIN_CANCELLED");

        assertRejected(reassign(target, court2, TOMORROW, "11:00"), ErrorCode.SLOT_TAKEN);
        assertRejected(reassign(target, court3, TOMORROW, "11:00"), ErrorCode.SLOT_TAKEN);
        assertThat(ok(reassign(target, court4, TOMORROW, "11:00")).get("resourceId").asLong()).isEqualTo(court4);
    }

    @Test
    @DisplayName("改派到原时段不算冲突：200，adminNote 更新并写日志")
    void reassigningToItsOwnSlotIsAllowed() throws Exception {
        JsonNode view = ok(reassign(target, court1, TOMORROW, "09:30"));

        assertThat(view.get("resourceId").asLong()).isEqualTo(court1);
        assertThat(view.get("startTime").asText()).isEqualTo("09:30");
        assertThat(view.get("adminNote").asText()).isEqualTo("场地调整");
        assertThat(onlyLog().get("action")).isEqualTo("RESERVATION_REASSIGN_RESOURCE");
    }

    @Test
    @DisplayName("改派后原时段释放，他人可以预约")
    void originalSlotIsReleased() throws Exception {
        ok(reassign(target, court2, TOMORROW, "11:00"));

        MvcResult created = send(HttpMethod.POST, "/api/v1/reservations",
                body("resourceId", court1, "serviceDate", TOMORROW.toString(), "startTime", "09:30"), lisi, Role.USER);

        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(created).get("userId").asLong()).isEqualTo(lisi);
    }

    @Test
    @DisplayName("已签到未结束 → ALREADY_CHECKED_IN（先于目标检查）；已签到且已结束 → INVALID_STATE（状态先于签到检查）")
    void checkedInReservationCannotBeReassigned() throws Exception {
        long inUse = reservation(lisi, court3, TODAY, "08:00");
        fixtures.usage(inUse, TODAY.atTime(7, 50), null);
        long ended = reservation(lisi, court4, TODAY, "06:30");
        fixtures.usage(ended, TODAY.atTime(6, 25), null);

        assertError(reassign(inUse, court2, TOMORROW, "11:00"), ErrorCode.ALREADY_CHECKED_IN);
        assertError(reassign(inUse, badmintonCourt, TOMORROW, "10:00"), ErrorCode.ALREADY_CHECKED_IN);
        JsonNode body = assertError(reassign(ended, court2, TOMORROW, "11:00"), ErrorCode.INVALID_STATE);
        assertThat(body.get("details").get("status").asText()).isEqualTo("COMPLETED");
        assertThat(reservationRow(inUse).get("resource_id")).isEqualTo(court3);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("字段格式：缺 resourceId / serviceDate / startTime 为“必填”；非法日期、时刻为“类型不符”；resourceId 非正 → 应为正整数")
    void malformedFieldsAreValidationErrors() throws Exception {
        JsonNode missing = assertError(asSys(HttpMethod.POST, REASSIGN_RESOURCE, body("reason", "原因"), target),
                ErrorCode.VALIDATION_ERROR);
        assertThat(missing.get("details").get("fields")).isEqualTo(objectMapper.valueToTree(
                Map.of("resourceId", "必填", "serviceDate", "必填", "startTime", "必填")));
        for (Object[] bad : new Object[][] {
                {"serviceDate", "2026-02-30", "类型不符"}, {"startTime", "9:30", "类型不符"},
                {"startTime", "24:00", "类型不符"}, {"resourceId", -1, "应为正整数"}}) {
            Map<String, Object> request = body("resourceId", court2, "serviceDate", TOMORROW.toString(),
                    "startTime", "11:00", "reason", "原因");
            request.put((String) bad[0], bad[1]);
            JsonNode body = assertError(asSys(HttpMethod.POST, REASSIGN_RESOURCE, request, target),
                    ErrorCode.VALIDATION_ERROR);
            assertThat(body.get("details").get("fields").get((String) bad[0]).asText()).isEqualTo(bad[2]);
        }
        assertThat(reservationRow(target).get("resource_id")).isEqualTo(court1);
        assertThat(logCount()).isZero();
    }
}
