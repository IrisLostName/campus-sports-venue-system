package com.campus.venue.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-2b 裁决 T2：影响检查六条（docs/12 第 5.5 节）在每个接口上的用例，由各接口的子类继承。
 * 受影响预约 target：zhangsan 明天 17:00 的网球场4；各子类发送一个会影响它的变更。
 * 另有 bystander：lisi 明天 17:00 的羽毛球场1（其他场馆），任何网球馆变更都不应碰它。
 */
public abstract class ImpactContractTests extends ImpactApiTestBase {

    protected long target;
    protected long bystander;

    @BeforeEach
    void seedReservations() {
        target = reservation(zhangsan, court4, TOMORROW, "17:00");
        bystander = reservation(lisi, badmintonCourt, TOMORROW, "17:00");
    }

    /** 发送会影响 target 的变更，control 为附加的控制字段（或其他字段）。 */
    protected abstract MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception;

    /** 库中是否已体现该变更。 */
    protected abstract boolean changeApplied();

    protected abstract String expectedAction();

    /** 一个字段格式错误的请求体片段（与 change 的请求体合并）。 */
    protected abstract Map<String, Object> invalidField();

    protected int appliedStatus() {
        return 200;
    }

    protected MvcResult changeAsSys(Map<String, Object> control) throws Exception {
        return change(control, sysAdmin, Role.SYS_ADMIN);
    }

    private void assertNothingWritten() {
        assertThat(changeApplied()).isFalse();
        assertThat(reservationStatus(target)).isEqualTo("CONFIRMED");
        assertThat(logCount()).isZero();
    }

    private void assertTargetBrief(JsonNode impact) {
        assertThat(impact.get("affectedCount").asInt()).isEqualTo(1);
        JsonNode brief = impact.get("reservations").get(0);
        assertThat(brief.get("id").asLong()).isEqualTo(target);
        assertThat(brief.get("resourceName").asText()).isEqualTo("网球场4");
        assertThat(brief.get("serviceDate").asText()).isEqualTo(TOMORROW.toString());
        assertThat(brief.get("startTime").asText()).isEqualTo("17:00");
        assertThat(brief.get("endTime").asText()).isEqualTo("18:30");
        assertThat(brief.get("userDisplayName").asText()).isEqualTo("用户zhangsan");
    }

    @Test
    void dryRunOnlyComputesAndWritesNothing() throws Exception {
        MvcResult result = changeAsSys(body("dryRun", true));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode response = json(result);
        assertThat(response.get("applied").asBoolean()).isFalse();
        assertThat(response.get("cancelledIds")).isEmpty();
        assertThat(response.get("data").isNull()).isTrue();
        assertTargetBrief(response.get("impact"));
        assertNothingWritten();
    }

    @Test
    void dryRunDoesNotRequireReasonEvenWithCancel() throws Exception {
        MvcResult result = changeAsSys(body("dryRun", true, "onExistingReservations", "CANCEL"));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(result).get("applied").asBoolean()).isFalse();
        assertNothingWritten();
    }

    @Test
    void affectedWithoutChoiceIsImpactConfirmationRequired() throws Exception {
        JsonNode error = assertError(changeAsSys(body()), ErrorCode.IMPACT_CONFIRMATION_REQUIRED);

        assertTargetBrief(error.get("details").get("impact"));
        assertNothingWritten();
    }

    @Test
    void keepAppliesChangeLeavesReservationAndLogsAffectedIds() throws Exception {
        MvcResult result = changeAsSys(body("onExistingReservations", "KEEP", "reason", "保留说明"));

        assertThat(result.getResponse().getStatus()).isEqualTo(appliedStatus());
        JsonNode response = json(result);
        assertThat(response.get("applied").asBoolean()).isTrue();
        assertThat(response.get("cancelledIds")).isEmpty();
        assertThat(response.get("data").isNull()).isFalse();
        assertTargetBrief(response.get("impact"));
        assertThat(changeApplied()).isTrue();
        assertThat(reservationStatus(target)).isEqualTo("CONFIRMED");
        assertThat(reservationRow(target).get("admin_note")).isNull();
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo(expectedAction());
        assertThat(log.get("reason")).isEqualTo("保留说明");
        assertThat(ids(snapshot(log, "before_snapshot").get("affectedReservationIds"))).containsExactly(target);
        assertThat(ids(snapshot(log, "after_snapshot").get("affectedReservationIds"))).containsExactly(target);
    }

    @Test
    void cancelAdminCancelsAffectedReservationsAndLogs() throws Exception {
        MvcResult result = changeAsSys(body("onExistingReservations", "CANCEL", "reason", "场地维修"));

        assertThat(result.getResponse().getStatus()).isEqualTo(appliedStatus());
        JsonNode response = json(result);
        assertThat(response.get("applied").asBoolean()).isTrue();
        assertThat(ids(response.get("cancelledIds"))).containsExactly(target);
        assertThat(changeApplied()).isTrue();
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("status")).isEqualTo("ADMIN_CANCELLED");
        assertThat(row.get("admin_note")).isEqualTo("场地维修");
        assertThat(row.get("cancelled_by")).isEqualTo(sysAdmin);
        assertThat(row.get("cancelled_at")).isEqualTo(Timestamp.valueOf(NOW));
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW));
        assertThat(row.get("cancel_reason")).isNull();
        assertThat(reservationStatus(bystander)).isEqualTo("CONFIRMED");
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo(expectedAction());
        assertThat(log.get("reason")).isEqualTo("场地维修");
        assertThat(log.get("admin_id")).isEqualTo(sysAdmin);
        assertThat(ids(snapshot(log, "after_snapshot").get("affectedReservationIds"))).containsExactly(target);
    }

    @Test
    void withoutAffectedReservationsExecutesDirectly() throws Exception {
        jdbc.update("update reservation set status = 'CANCELLED' where id = ?", target);

        MvcResult result = changeAsSys(body());

        assertThat(result.getResponse().getStatus()).isEqualTo(appliedStatus());
        JsonNode response = json(result);
        assertThat(response.get("applied").asBoolean()).isTrue();
        assertThat(response.get("impact").get("affectedCount").asInt()).isZero();
        assertThat(response.get("impact").get("reservations")).isEmpty();
        assertThat(changeApplied()).isTrue();
        Map<String, Object> log = onlyLog();
        assertThat(log.get("reason")).isNull();
        assertThat(snapshot(log, "after_snapshot").get("affectedReservationIds")).isEmpty();
    }

    @Test
    void cancelWithoutReasonIsReasonRequired() throws Exception {
        for (Map<String, Object> control : List.of(body("onExistingReservations", "CANCEL"),
                body("onExistingReservations", "CANCEL", "reason", "   "),
                body("onExistingReservations", "CANCEL", "reason", null, "dryRun", false))) {
            JsonNode error = assertError(changeAsSys(control), ErrorCode.REASON_REQUIRED);
            assertThat(error.has("details")).isFalse();
        }
        assertNothingWritten();
    }

    @Test
    void reasonRequiredComesBeforeRoleCheck() throws Exception {
        assertError(change(body("onExistingReservations", "CANCEL"), zhangsan, Role.USER),
                ErrorCode.REASON_REQUIRED);
        assertError(change(body("onExistingReservations", "KEEP"), zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertNothingWritten();
    }

    @Test
    void fieldFormatComesBeforeReasonRequired() throws Exception {
        MvcResult result = changeAsSys(merge(invalidField(), body("onExistingReservations", "CANCEL")));

        JsonNode error = assertError(result, ErrorCode.VALIDATION_ERROR);
        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.size()).isPositive();
        fields.fieldNames().forEachRemaining(name -> assertThat(name).doesNotEndWith("Request"));
        assertNothingWritten();
    }

    @Test
    void controlFieldsAreFormatChecked() throws Exception {
        JsonNode error = assertError(changeAsSys(body("onExistingReservations", "DELETE", "reason", "x".repeat(201))),
                ErrorCode.VALIDATION_ERROR);

        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.get("onExistingReservations").asText()).isEqualTo("须为 KEEP 或 CANCEL");
        assertThat(fields.get("reason").asText()).isEqualTo("不能超过 200 个字符");
        assertError(changeAsSys(body("dryRun", "maybe")), ErrorCode.VALIDATION_ERROR);
        assertNothingWritten();
    }
}
