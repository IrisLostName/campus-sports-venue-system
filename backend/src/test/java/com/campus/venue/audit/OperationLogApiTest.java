package com.campus.venue.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.domain.LogTargetType;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.transaction.IllegalTransactionStateException;

/**
 * BE-2b L1–L3、T5：日志与业务变更同事务——业务失败（RULE_INVALID、409、重名、缺省报错）时既不改数据也不写日志；
 * 日志组件只能在调用方的事务内使用；action → targetType 固定对应。
 */
class OperationLogApiTest extends ImpactApiTestBase {

    @Autowired
    private OperationLogWriter logWriter;

    private String venueState() {
        return jdbc.queryForObject("select name || '|' || operational_status from venue where id = ?", String.class,
                tennis);
    }

    @Test
    void failedChangesWriteNeitherDataNorLog() throws Exception {
        long booked = reservation(zhangsan, court4, TOMORROW, "17:00");

        assertError(asSys(HttpMethod.PATCH, "/api/v1/admin/venues/{id}", body("operationalStatus", "CLOSED",
                "name", "新名"), tennis), ErrorCode.IMPACT_CONFIRMATION_REQUIRED);
        assertError(asSys(HttpMethod.PATCH, "/api/v1/admin/venues/{id}", body("name", "羽毛球馆"), tennis),
                ErrorCode.VALIDATION_ERROR);
        assertError(asSys(HttpMethod.PUT, "/api/v1/admin/venues/{id}/resource-count", body("count", 1), tennis),
                ErrorCode.IMPACT_CONFIRMATION_REQUIRED);
        assertError(asSys(HttpMethod.PUT, "/api/v1/admin/venues/{id}/availability-rules/weekly",
                body("windows", List.of(body("weekday", 1, "openTime", "08:00", "closeTime", "20:30"))), tennis),
                ErrorCode.RULE_INVALID);
        assertError(asSys(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures", body("startDate",
                TOMORROW.toString(), "endDate", TOMORROW.toString()), tennis), ErrorCode.IMPACT_CONFIRMATION_REQUIRED);

        assertThat(venueState()).isEqualTo("网球馆|OPEN");
        assertThat(jdbc.queryForObject("select count(*) from resource where venue_id = ? and operational_status"
                + " = 'OPEN'", Integer.class, tennis)).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from availability_rule where venue_id = ? and status ="
                + " 'ACTIVE'", Integer.class, tennis)).isEqualTo(7);
        assertThat(reservationStatus(booked)).isEqualTo("CONFIRMED");
        assertThat(logCount()).isZero();
    }

    @Test
    void writerRefusesToRunOutsideATransaction() {
        OperationLogWriter.Entry entry = new OperationLogWriter.Entry(sysAdmin, tennis, LogAction.VENUE_UPDATE,
                tennis, null, null, null, List.of());

        assertThatThrownBy(() -> logWriter.write(entry)).isInstanceOf(IllegalTransactionStateException.class);
        assertThat(logCount()).isZero();
    }

    @Test
    void everyActionHasItsFixedTargetType() {
        Map<LogAction, LogTargetType> expected = Map.ofEntries(
                Map.entry(LogAction.RESERVATION_CANCEL, LogTargetType.RESERVATION),
                Map.entry(LogAction.RESERVATION_REASSIGN_RESOURCE, LogTargetType.RESERVATION),
                Map.entry(LogAction.RESERVATION_REASSIGN_USER, LogTargetType.RESERVATION),
                Map.entry(LogAction.RESOURCE_STATUS_CHANGE, LogTargetType.RESOURCE),
                Map.entry(LogAction.RESOURCE_COUNT_CHANGE, LogTargetType.VENUE),
                Map.entry(LogAction.VENUE_UPDATE, LogTargetType.VENUE),
                Map.entry(LogAction.RULE_WEEKLY_UPDATE, LogTargetType.RULE),
                Map.entry(LogAction.CLOSURE_ADD, LogTargetType.RULE),
                Map.entry(LogAction.CLOSURE_REMOVE, LogTargetType.RULE),
                Map.entry(LogAction.SCOPE_UPDATE, LogTargetType.SCOPE),
                Map.entry(LogAction.USER_CREATE, LogTargetType.USER),
                Map.entry(LogAction.USER_STATUS_CHANGE, LogTargetType.USER),
                Map.entry(LogAction.ANNOUNCEMENT_PUBLISH, LogTargetType.ANNOUNCEMENT),
                Map.entry(LogAction.ANNOUNCEMENT_ARCHIVE, LogTargetType.ANNOUNCEMENT),
                Map.entry(LogAction.REPAIR_UPDATE, LogTargetType.REPAIR));
        for (LogAction action : LogAction.values()) {
            assertThat(OperationLogWriter.targetTypeOf(action)).as(action.name()).isEqualTo(expected.get(action));
        }
    }
}
