package com.campus.venue.audit.service;

import com.campus.venue.audit.domain.AdminOperationLog;
import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.dto.OperationLogView;
import com.campus.venue.audit.repository.AdminOperationLogRepository;
import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.common.repository.SpecificationPages;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.service.DisplayNames;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 操作记录查询（docs/12 第 5.10 节，BE-6 L1、L2），与 mock logService.ts 的 listLogs、visibleLogs 一致。
 * 格式与角色（VA、SA）在控制器完成。
 */
@Service
public class OperationLogQueryService {

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt", "id");

    private final AdminOperationLogRepository logs;
    private final SpecificationPages pages;
    private final VenueScopeGuard venueScopeGuard;
    private final DisplayNames displayNames;

    public OperationLogQueryService(AdminOperationLogRepository logs, SpecificationPages pages,
            VenueScopeGuard venueScopeGuard, DisplayNames displayNames) {
        this.logs = logs;
        this.pages = pages;
        this.venueScopeGuard = venueScopeGuard;
        this.displayNames = displayNames;
    }

    /** 过滤条件（已通过格式校验，均可为 null）。 */
    public record Query(Long venueId, LogAction action, LocalDate dateFrom, LocalDate dateTo, int page,
            int pageSize) {
    }

    /**
     * 给了 venueId 先做授权检查（VA 越权 FORBIDDEN_SCOPE，含不存在的场馆；SA 得空页）。可见性：SA 全部；VA 只见 venue_id 属于其
     * 当前有效授权场馆的日志（含其他管理员写的），venue_id 为空的不可见；授权为空时直接空页（不生成 IN ()）。
     * 日期按 created_at 的本地日期、两端含；dateFrom 晚于 dateTo 得空页。按 created_at、id 倒序，数据库分页。
     */
    @Transactional(readOnly = true)
    public PageView<OperationLogView> list(AuthenticatedUser user, Query query) {
        if (query.venueId() != null) {
            venueScopeGuard.requireVenueAccess(user, query.venueId());
        }
        List<Long> visibleVenueIds = user.role() == Role.SYS_ADMIN ? null
                : venueScopeGuard.effectiveVenueIds(user.id());
        boolean emptyRange = query.dateFrom() != null && query.dateTo() != null
                && query.dateFrom().isAfter(query.dateTo());
        if (emptyRange || visibleVenueIds != null && visibleVenueIds.isEmpty()) {
            return new PageView<>(List.of(), query.page(), query.pageSize(), 0);
        }
        Specification<AdminOperationLog> spec = spec(query, visibleVenueIds);
        return DatabasePaging.page(query.page(), query.pageSize(), NEWEST_FIRST, () -> logs.count(spec),
                request -> pages.find(AdminOperationLog.class, spec, request), this::toViews);
    }

    /** visibleVenueIds 为 null 表示不限（SA）。 */
    private static Specification<AdminOperationLog> spec(Query query, List<Long> visibleVenueIds) {
        return (root, criteria, cb) -> {
            List<Predicate> list = new ArrayList<>();
            if (visibleVenueIds != null) {
                list.add(root.get("venueId").in(visibleVenueIds));
            }
            if (query.venueId() != null) {
                list.add(cb.equal(root.get("venueId"), query.venueId()));
            }
            if (query.action() != null) {
                list.add(cb.equal(root.get("action"), query.action()));
            }
            if (query.dateFrom() != null) {
                list.add(cb.greaterThanOrEqualTo(root.get("createdAt"), query.dateFrom().atStartOfDay()));
            }
            if (query.dateTo() != null) {
                LocalDateTime nextDay = query.dateTo().plusDays(1).atStartOfDay();
                list.add(cb.lessThan(root.get("createdAt"), nextDay));
            }
            return cb.and(list.toArray(Predicate[]::new));
        };
    }

    private List<OperationLogView> toViews(List<AdminOperationLog> slice) {
        Map<Long, String> names = displayNames.of(slice.stream().map(AdminOperationLog::getAdminId).toList());
        return slice.stream().map(log -> new OperationLogView(log.getId(), log.getAdminId(),
                names.get(log.getAdminId()), log.getVenueId(), log.getAction(), log.getTargetType(), log.getTargetId(),
                log.getReason(), log.getBeforeSnapshot(), log.getAfterSnapshot(), log.getCreatedAt())).toList();
    }
}
