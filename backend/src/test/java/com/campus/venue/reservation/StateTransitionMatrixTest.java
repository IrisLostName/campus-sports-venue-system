package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.service.ReservationSweepService;
import com.campus.venue.reservation.service.ReservationSweepService.SweepResult;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 S2 状态迁移（docs/03 第 4.2、4.3 节）：每一条允许的迁移与每一条被拒的迁移。时钟 2026-10-12 08:30:15。
 * 被拒：库中四种终态，以及“有效状态已是终态”的 CONFIRMED（越过未到场判定点未签到 → NO_SHOW；已签到且已结束 → COMPLETED），
 * 对用户取消、签到、签退、管理员取消、资源改派、人员改派六个动作都得 INVALID_STATE {status: 有效状态}，预约、使用记录、日志不变；
 * 随后清扫把有效终态落库、库中终态不动（终态一旦进入不再变化）。今天 06:30–08:00 的时段已过签退宽限（08:30:00）。
 */
@DisplayName("TEST-1 预约状态迁移")
class StateTransitionMatrixTest extends AdminReservationApiTestBase {

    @Autowired
    private ReservationSweepService sweepService;

    @FunctionalInterface
    private interface Action {
        MvcResult on(long id) throws Exception;
    }

    private Map<String, Action> actions() {
        Map<String, Action> map = new LinkedHashMap<>();
        map.put("用户取消", id -> send(HttpMethod.POST, "/api/v1/reservations/{id}/cancel", null, zhangsan, Role.USER,
                id));
        map.put("签到", id -> send(HttpMethod.POST, "/api/v1/reservations/{id}/check-in", null, zhangsan, Role.USER,
                id));
        map.put("签退", id -> send(HttpMethod.POST, "/api/v1/reservations/{id}/check-out", null, zhangsan, Role.USER,
                id));
        map.put("管理员取消", id -> asSys(HttpMethod.POST, CANCEL, body("reason", "调整"), id));
        map.put("资源改派", id -> asSys(HttpMethod.POST, REASSIGN_RESOURCE, body("resourceId", court2, "serviceDate",
                TOMORROW.toString(), "startTime", "11:00", "reason", "调整"), id));
        map.put("人员改派", id -> asSys(HttpMethod.POST, REASSIGN_USER, body("userId", lisi, "reason", "调整"), id));
        return map;
    }

    /** 名称、库中状态、开始时间（今天）、是否有签到记录、有效状态。 */
    static List<Arguments> refused() {
        return List.of(
                Arguments.of("库中 CANCELLED", "CANCELLED", "06:30", false, "CANCELLED"),
                Arguments.of("库中 ADMIN_CANCELLED", "ADMIN_CANCELLED", "06:30", false, "ADMIN_CANCELLED"),
                Arguments.of("库中 NO_SHOW", "NO_SHOW", "06:30", false, "NO_SHOW"),
                Arguments.of("库中 COMPLETED（已签到，已过签退宽限）", "COMPLETED", "06:30", true, "COMPLETED"),
                Arguments.of("CONFIRMED 越过未到场判定点、未签到 → 有效 NO_SHOW", "CONFIRMED", "08:00", false, "NO_SHOW"),
                Arguments.of("CONFIRMED 已签到且已结束 → 有效 COMPLETED", "CONFIRMED", "06:30", true, "COMPLETED"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("refused")
    @DisplayName("被拒迁移：终态或有效终态 × 六个动作 → INVALID_STATE {status: 有效状态}；数据与日志不变；清扫只落库有效终态")
    void terminalStatesRefuseEveryAction(String name, String stored, String start, boolean checkedIn,
            String effective) throws Exception {
        long id = fixtures.reservation(zhangsan, court1, TODAY, start, stored);
        if (checkedIn) {
            fixtures.usage(id, TODAY.atTime(6, 25), null);
        }
        Map<String, Object> before = reservationRow(id);

        for (Map.Entry<String, Action> action : actions().entrySet()) {
            JsonNode body = assertError(action.getValue().on(id), ErrorCode.INVALID_STATE);
            assertThat(body.get("details").get("status").asText()).as(action.getKey()).isEqualTo(effective);
            assertThat(reservationRow(id)).as(action.getKey()).isEqualTo(before);
        }
        assertThat(jdbc.queryForObject("select count(*) from usage_record where reservation_id = ?", Integer.class,
                id)).isEqualTo(checkedIn ? 1 : 0);
        assertThat(logCount()).isZero();

        sweepService.sweep();
        assertThat(reservationStatus(id)).isEqualTo(effective);
        sweepService.sweep();
        assertThat(reservationStatus(id)).isEqualTo(effective);
    }

    @Test
    @DisplayName("允许迁移：CONFIRMED → CANCELLED（用户）、ADMIN_CANCELLED（管理员单条与影响检查批量）、NO_SHOW 与 COMPLETED（清扫）")
    void everyAllowedTransitionFromConfirmed() throws Exception {
        long byUser = reservation(zhangsan, court1, TOMORROW, "11:00");
        long byAdmin = reservation(zhangsan, court2, TOMORROW, "11:00");
        long byImpact = reservation(lisi, court4, TOMORROW, "11:00");
        long noShow = fixtures.reservation(zhangsan, court3, TODAY, "08:00", "CONFIRMED");
        long completed = fixtures.reservation(lisi, court3, TODAY, "06:30", "CONFIRMED");
        fixtures.usage(completed, TODAY.atTime(6, 25), null);

        assertThat(json(send(HttpMethod.POST, "/api/v1/reservations/{id}/cancel", null, zhangsan, Role.USER,
                byUser)).get("status").asText()).isEqualTo("CANCELLED");
        assertThat(ok(asSys(HttpMethod.POST, CANCEL, body("reason", "调整"), byAdmin)).get("status").asText())
                .isEqualTo("ADMIN_CANCELLED");
        assertThat(asSys(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body("operationalStatus", "MAINTENANCE",
                "onExistingReservations", "CANCEL", "reason", "检修"), court4).getResponse().getStatus())
                .isEqualTo(200);
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(1, 1));

        assertThat(List.of(byUser, byAdmin, byImpact, noShow, completed)).extracting(this::reservationStatus)
                .containsExactly("CANCELLED", "ADMIN_CANCELLED", "ADMIN_CANCELLED", "NO_SHOW", "COMPLETED");
        assertThat(sweepService.sweep()).isEqualTo(new SweepResult(0, 0));
    }

    @Test
    @DisplayName("允许：库中 COMPLETED、已签到未签退、在签退宽限内 → 签退成功，状态仍为 COMPLETED；改派不改变状态（仍 CONFIRMED）")
    void checkOutAfterCompletionAndReassignmentKeepTheStatus() throws Exception {
        LocalDate today = TODAY;
        long completed = fixtures.reservation(zhangsan, court1, today, "06:30", "COMPLETED");
        fixtures.usage(completed, today.atTime(6, 25), null);
        clock.setLocal(today.atTime(8, 29, 59));
        JsonNode checkedOut = json(send(HttpMethod.POST, "/api/v1/reservations/{id}/check-out", null, zhangsan,
                Role.USER, completed));
        assertThat(checkedOut.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(checkedOut.get("checkOutAt").asText()).isEqualTo("2026-10-12T08:29:59");

        long moved = reservation(zhangsan, court2, TOMORROW, "09:30");
        assertThat(ok(asSys(HttpMethod.POST, REASSIGN_USER, body("userId", lisi, "reason", "代订"), moved))
                .get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(reservationStatus(moved)).isEqualTo("CONFIRMED");
    }
}
