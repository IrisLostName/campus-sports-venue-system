package com.campus.venue.repair.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.repository.SpecificationPages;
import com.campus.venue.repair.domain.RepairReport;
import com.campus.venue.repair.domain.RepairStatus;
import com.campus.venue.repair.dto.RepairReportView;
import com.campus.venue.repair.dto.UpdateRepairRequest;
import com.campus.venue.repair.repository.RepairReportRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 管理端报修（docs/12 第 5.4 节，BE-6 R3、R4），与 mock contentService.ts 的 adminListRepairs、updateRepair 一致。
 * 格式与角色（VA、SA）在控制器完成。
 */
@Service
public class RepairAdminService {

    /** 管理端列表固定每页 20 条（BE-6 C2）。 */
    static final int ADMIN_PAGE_SIZE = 20;
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt", "id");

    private final RepairReportRepository repairs;
    private final SpecificationPages pages;
    private final RepairViewMapper mapper;
    private final VenueScopeGuard venueScopeGuard;
    private final OperationLogWriter logWriter;
    private final Clock clock;

    public RepairAdminService(RepairReportRepository repairs, SpecificationPages pages, RepairViewMapper mapper,
            VenueScopeGuard venueScopeGuard, OperationLogWriter logWriter, Clock clock) {
        this.repairs = repairs;
        this.pages = pages;
        this.mapper = mapper;
        this.venueScopeGuard = venueScopeGuard;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    /**
     * R3：给了 venueId 先做授权检查（FORBIDDEN_SCOPE；SA 传不存在的场馆得空页）；VA 只含当前有效授权场馆，
     * 授权为空时直接返回空页（不生成 IN ()）。按提交时刻、id 倒序，数据库分页。
     */
    @Transactional(readOnly = true)
    public PageView<RepairReportView> list(AuthenticatedUser user, Long venueId, RepairStatus status, int page) {
        if (venueId != null) {
            venueScopeGuard.requireVenueAccess(user, venueId);
        }
        List<Long> visibleVenueIds = user.role() == Role.SYS_ADMIN ? null
                : venueScopeGuard.effectiveVenueIds(user.id());
        if (visibleVenueIds != null && visibleVenueIds.isEmpty()) {
            return new PageView<>(List.of(), page, ADMIN_PAGE_SIZE, 0);
        }
        Specification<RepairReport> spec = (root, query, cb) -> {
            List<Predicate> list = new ArrayList<>();
            if (visibleVenueIds != null) {
                list.add(root.get("venueId").in(visibleVenueIds));
            }
            if (venueId != null) {
                list.add(cb.equal(root.get("venueId"), venueId));
            }
            if (status != null) {
                list.add(cb.equal(root.get("status"), status));
            }
            return cb.and(list.toArray(Predicate[]::new));
        };
        return DatabasePaging.page(page, ADMIN_PAGE_SIZE, NEWEST_FIRST, () -> repairs.count(spec),
                request -> pages.find(RepairReport.class, spec, request), mapper::toViews);
    }

    /**
     * R4：锁定报修行 → NOT_FOUND → FORBIDDEN_SCOPE → 迁移只允许 SUBMITTED → IN_PROGRESS / RESOLVED、
     * IN_PROGRESS → RESOLVED，其余（含重复）INVALID_STATE {status: 当前状态}。resultNote 未给则保留原值；
     * handled_by 为当前管理员；updated_at 取 Clock。写 REPAIR_UPDATE。
     */
    @Transactional
    public RepairReportView update(AuthenticatedUser user, long id, UpdateRepairRequest request) {
        RepairReport report = repairs.lockById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        venueScopeGuard.requireVenueAccess(user, report.getVenueId());
        RepairStatus target = RepairStatus.valueOf(request.status());
        if (!canTransition(report.getStatus(), target)) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", report.getStatus().name()));
        }
        RepairReportView before = mapper.toView(report);
        report.setStatus(target);
        if (request.resultNote() != null) {
            report.setResultNote(request.resultNote());
        }
        report.setHandledBy(user.id());
        report.setUpdatedAt(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        repairs.saveAndFlush(report);
        RepairReportView after = mapper.toView(report);
        logWriter.write(new OperationLogWriter.Entry(user.id(), report.getVenueId(), LogAction.REPAIR_UPDATE,
                report.getId(), null, before, after, List.of()));
        return after;
    }

    static boolean canTransition(RepairStatus from, RepairStatus to) {
        return from == RepairStatus.SUBMITTED && (to == RepairStatus.IN_PROGRESS || to == RepairStatus.RESOLVED)
                || from == RepairStatus.IN_PROGRESS && to == RepairStatus.RESOLVED;
    }
}
