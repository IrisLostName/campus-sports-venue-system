package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 C1、T2：三个管理员覆盖接口共同的阶段顺序——认证 → 字段格式 VALIDATION_ERROR → REASON_REQUIRED → 角色 FORBIDDEN
 * → 预约不存在 NOT_FOUND → 越权 FORBIDDEN_SCOPE → INVALID_STATE（有效状态非 CONFIRMED 或已结束，details.status 为有效状态）。
 * 每一步至少一例并证明与相邻步骤的先后；任何失败都不改预约、不写日志（ACC-M3-06“失败不写”）。
 */
class AdminOverridePhaseOrderTest extends AdminReservationApiTestBase {

    private long target;
    private Map<String, Object> targetRow;

    @BeforeEach
    void seedTarget() {
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
        targetRow = reservationRow(target);
    }

    static Stream<String> endpoints() {
        return Stream.of(CANCEL, REASSIGN_RESOURCE, REASSIGN_USER);
    }

    /** 该接口的合法请求体（原因由参数给出，null 表示不带 reason 键）。 */
    private Map<String, Object> validBody(String url, String reason) {
        Map<String, Object> body = switch (url) {
            case REASSIGN_RESOURCE -> body("resourceId", court2, "serviceDate", TOMORROW.toString(),
                    "startTime", "11:00");
            case REASSIGN_USER -> body("userId", lisi);
            default -> body();
        };
        if (reason != null) {
            body.put("reason", reason);
        }
        return body;
    }

    /** 字段格式错误的请求体：取消为超长原因，两类改派为非法 id；都不带 reason。 */
    private Map<String, Object> malformedBody(String url) {
        return switch (url) {
            case REASSIGN_RESOURCE -> body("resourceId", 0, "serviceDate", TOMORROW.toString(), "startTime", "11:00");
            case REASSIGN_USER -> body("userId", 0);
            default -> body("reason", "长".repeat(201));
        };
    }

    private static String malformedField(String url) {
        return switch (url) {
            case REASSIGN_RESOURCE -> "resourceId";
            case REASSIGN_USER -> "userId";
            default -> "reason";
        };
    }

    private void assertUntouched() {
        assertThat(reservationRow(target)).isEqualTo(targetRow);
        assertThat(logCount()).isZero();
    }

    private void assertInvalidState(MvcResult result, String status) throws Exception {
        JsonNode body = assertError(result, ErrorCode.INVALID_STATE);
        assertThat(body.get("details")).isEqualTo(objectMapper.valueToTree(Map.of("status", status)));
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("未登录 → 401 AUTH_REQUIRED（先于一切）")
    void unauthenticatedIsAuthRequired(String url) throws Exception {
        MvcResult result = mockMvc.perform(post(url, target).contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andReturn();
        assertError(result, ErrorCode.AUTH_REQUIRED);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("格式先于 REASON_REQUIRED：字段格式错误且缺原因 → VALIDATION_ERROR（USER 也是）")
    void formatComesBeforeReasonRequired(String url) throws Exception {
        JsonNode body = assertError(send(HttpMethod.POST, url, malformedBody(url), zhangsan, Role.USER, target),
                ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").has(malformedField(url))).isTrue();
        assertError(asSys(HttpMethod.POST, url, malformedBody(url), target), ErrorCode.VALIDATION_ERROR);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("REASON_REQUIRED 先于角色：缺 reason、null、空串、空白，USER 也得 REASON_REQUIRED")
    void reasonRequiredComesBeforeRole(String url) throws Exception {
        assertError(send(HttpMethod.POST, url, validBody(url, null), zhangsan, Role.USER, target),
                ErrorCode.REASON_REQUIRED);
        Map<String, Object> nullReason = validBody(url, null);
        nullReason.put("reason", null);
        assertError(asSys(HttpMethod.POST, url, nullReason, target), ErrorCode.REASON_REQUIRED);
        assertError(asSys(HttpMethod.POST, url, validBody(url, ""), target), ErrorCode.REASON_REQUIRED);
        assertError(asTennisAdmin(HttpMethod.POST, url, validBody(url, " \t "), target), ErrorCode.REASON_REQUIRED);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("请求体整体缺失 → VALIDATION_ERROR（无 details）；{} → REASON_REQUIRED（取消）或字段错误（改派）")
    void missingBodyIsAValidationError(String url) throws Exception {
        MvcResult result = mockMvc.perform(post(url, target)
                .header(HttpHeaders.AUTHORIZATION, bearer(sysAdmin, Role.SYS_ADMIN))
                .contentType(MediaType.APPLICATION_JSON)).andReturn();
        assertThat(assertError(result, ErrorCode.VALIDATION_ERROR).has("details")).isFalse();
        assertError(asSys(HttpMethod.POST, url, body(), target),
                CANCEL.equals(url) ? ErrorCode.REASON_REQUIRED : ErrorCode.VALIDATION_ERROR);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("角色：USER 带合法请求体 → FORBIDDEN（先于 NOT_FOUND）")
    void userRoleIsForbidden(String url) throws Exception {
        assertError(send(HttpMethod.POST, url, validBody(url, "原因"), zhangsan, Role.USER, target),
                ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.POST, url, validBody(url, "原因"), zhangsan, Role.USER, 999999),
                ErrorCode.FORBIDDEN);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("NOT_FOUND 先于范围：不存在的预约对 SYS_ADMIN 与 VENUE_ADMIN 都是 NOT_FOUND")
    void unknownReservationIsNotFound(String url) throws Exception {
        assertError(asSys(HttpMethod.POST, url, validBody(url, "原因"), 999999), ErrorCode.NOT_FOUND);
        assertError(asTennisAdmin(HttpMethod.POST, url, validBody(url, "原因"), 999999), ErrorCode.NOT_FOUND);
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("ACC-M3-07 FORBIDDEN_SCOPE 先于 INVALID_STATE：未授权场馆的预约（即使已是 NO_SHOW）→ FORBIDDEN_SCOPE {venueId}")
    void scopeComesBeforeState(String url) throws Exception {
        long foreignDue = reservation(lisi, badmintonCourt, TODAY, "08:00");
        long foreignFuture = reservation(lisi, badmintonCourt, TOMORROW, "09:30");

        for (long id : new long[] {foreignDue, foreignFuture}) {
            JsonNode body = assertError(asTennisAdmin(HttpMethod.POST, url, validBody(url, "原因"), id),
                    ErrorCode.FORBIDDEN_SCOPE);
            assertThat(body.get("details").size()).isEqualTo(1);
            assertThat(body.get("details").get("venueId").asLong()).isEqualTo(badminton);
        }
        assertThat(reservationStatus(foreignFuture)).isEqualTo("CONFIRMED");
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("INVALID_STATE：库中 CONFIRMED 但已越过签到窗口（有效 NO_SHOW）→ {status: NO_SHOW}，库中不变")
    void overdueReservationIsInvalidStateNoShow(String url) throws Exception {
        long overdue = reservation(zhangsan, court3, TODAY, "08:00");

        assertInvalidState(asSys(HttpMethod.POST, url, validBody(url, "原因"), overdue), "NO_SHOW");
        assertThat(reservationStatus(overdue)).isEqualTo("CONFIRMED");
        assertThat(reservationRow(overdue).get("admin_note")).isNull();
        assertUntouched();
    }

    @ParameterizedTest
    @MethodSource("endpoints")
    @DisplayName("INVALID_STATE：已签到且已结束（有效 COMPLETED）、已取消、管理员取消、已落库 NO_SHOW / COMPLETED")
    void finishedOrCancelledReservationsAreInvalidState(String url) throws Exception {
        long ended = reservation(zhangsan, court3, TODAY, "06:30");
        fixtures.usage(ended, TODAY.atTime(6, 25), null);
        assertInvalidState(asSys(HttpMethod.POST, url, validBody(url, "原因"), ended), "COMPLETED");
        for (String status : new String[] {"CANCELLED", "ADMIN_CANCELLED", "NO_SHOW", "COMPLETED"}) {
            long id = fixtures.reservation(zhangsan, court4, TOMORROW.plusDays(1), "08:00", status);
            assertInvalidState(asTennisAdmin(HttpMethod.POST, url, validBody(url, "原因"), id), status);
            jdbc.update("delete from reservation where id = ?", id);
        }
        assertUntouched();
    }
}
