package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.audit.domain.AdminOperationLog;
import com.campus.venue.audit.domain.AdminVenueScope;
import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.domain.LogTargetType;
import com.campus.venue.audit.domain.VenueScopeStatus;
import com.campus.venue.repair.domain.RepairReport;
import com.campus.venue.repair.domain.RepairStatus;
import com.campus.venue.support.AbstractEntityTest;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** 实体往返测试（三）：repair_report、admin_venue_scope、admin_operation_log（含 JSONB）。 */
class AuditRoundTripTest extends AbstractEntityTest {

    @Test
    void repairReportRoundTrip() {
        AppUser reporter = newUser("rep_user", Role.USER);
        AppUser handler = newUser("rep_admin", Role.VENUE_ADMIN);
        Venue venue = newVenue("报修馆");
        Resource resource = newResource(venue, "报修场1");
        RepairReport report = new RepairReport();
        report.setVenueId(venue.getId());
        report.setResourceId(resource.getId());
        report.setReporterId(reporter.getId());
        report.setDescription("球网破损");
        report.setStatus(RepairStatus.IN_PROGRESS);
        report.setResultNote("已联系供应商");
        report.setHandledBy(handler.getId());
        report.setCreatedAt(NOW);
        report.setUpdatedAt(NOW.plusHours(2));
        persist(report);

        RepairReport loaded = reload(RepairReport.class, report.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(report);
        assertThat(text("select status from repair_report where id = ?", report.getId())).isEqualTo("IN_PROGRESS");
        assertThat(text("select updated_at::text from repair_report where id = ?", report.getId()))
                .isEqualTo("2026-10-12 10:30:15");
    }

    @Test
    void repairReportForWholeVenueKeepsResourceNull() {
        Venue venue = newVenue("整体报修馆");
        RepairReport report = new RepairReport();
        report.setVenueId(venue.getId());
        report.setReporterId(newUser("rep_user2", Role.USER).getId());
        report.setDescription("灯光故障");
        report.setCreatedAt(NOW);
        report.setUpdatedAt(NOW);
        persist(report);

        RepairReport loaded = reload(RepairReport.class, report.getId());

        assertThat(loaded.getResourceId()).isNull();
        assertThat(loaded.getHandledBy()).isNull();
        assertThat(loaded.getStatus()).isEqualTo(RepairStatus.SUBMITTED);
    }

    @Test
    void adminVenueScopeRoundTrip() {
        AppUser admin = newUser("scope_admin", Role.VENUE_ADMIN);
        AppUser sys = newUser("scope_sys", Role.SYS_ADMIN);
        Venue venue = newVenue("授权馆");
        AdminVenueScope scope = new AdminVenueScope();
        scope.setAdminId(admin.getId());
        scope.setVenueId(venue.getId());
        scope.setStatus(VenueScopeStatus.REVOKED);
        scope.setValidFrom(LocalDate.of(2026, 10, 1));
        scope.setValidTo(LocalDate.of(2026, 12, 31));
        scope.setGrantedBy(sys.getId());
        scope.setGrantedAt(NOW);
        persist(scope);

        AdminVenueScope loaded = reload(AdminVenueScope.class, scope.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(scope);
        assertThat(text("select status from admin_venue_scope where id = ?", scope.getId())).isEqualTo("REVOKED");
        assertThat(text("select valid_from::text from admin_venue_scope where id = ?", scope.getId()))
                .isEqualTo("2026-10-01");
        assertThat(text("select valid_to::text from admin_venue_scope where id = ?", scope.getId()))
                .isEqualTo("2026-12-31");
    }

    @Test
    void adminOperationLogRoundTripWithObjectAndArraySnapshots() throws Exception {
        AppUser admin = newUser("log_admin", Role.SYS_ADMIN);
        Venue venue = newVenue("日志馆");
        AdminOperationLog log = new AdminOperationLog();
        log.setAdminId(admin.getId());
        log.setVenueId(venue.getId());
        log.setAction(LogAction.RESERVATION_CANCEL);
        log.setTargetType(LogTargetType.RESERVATION);
        log.setTargetId(42L);
        log.setReason("场地维修");
        JsonNode before = objectMapper.readTree("{\"status\":\"CONFIRMED\",\"affected\":[101,102]}");
        JsonNode after = objectMapper.readTree("[101,102]");
        log.setBeforeSnapshot(before);
        log.setAfterSnapshot(after);
        log.setCreatedAt(NOW);
        persist(log);

        AdminOperationLog loaded = reload(AdminOperationLog.class, log.getId());

        assertThat(loaded).usingRecursiveComparison()
                .ignoringFields("beforeSnapshot", "afterSnapshot").isEqualTo(log);
        assertThat(loaded.getBeforeSnapshot()).isEqualTo(before);
        assertThat(loaded.getAfterSnapshot()).isEqualTo(after);
        Long id = log.getId();
        assertThat(text("select jsonb_typeof(before_snapshot) from admin_operation_log where id = ?", id))
                .isEqualTo("object");
        assertThat(text("select jsonb_typeof(after_snapshot) from admin_operation_log where id = ?", id))
                .isEqualTo("array");
        assertThat(text("select action from admin_operation_log where id = ?", id)).isEqualTo("RESERVATION_CANCEL");
        assertThat(text("select target_type from admin_operation_log where id = ?", id)).isEqualTo("RESERVATION");
    }

    @Test
    void adminOperationLogAllowsMissingSnapshotsAndVenue() {
        AdminOperationLog log = new AdminOperationLog();
        log.setAdminId(newUser("log_admin2", Role.SYS_ADMIN).getId());
        log.setAction(LogAction.USER_CREATE);
        log.setTargetType(LogTargetType.USER);
        log.setCreatedAt(NOW);
        persist(log);

        AdminOperationLog loaded = reload(AdminOperationLog.class, log.getId());

        assertThat(loaded.getBeforeSnapshot()).isNull();
        assertThat(loaded.getAfterSnapshot()).isNull();
        assertThat(loaded.getVenueId()).isNull();
        assertThat(loaded.getTargetId()).isNull();
    }
}
