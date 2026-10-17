package com.campus.venue.audit.service;

import com.campus.venue.audit.domain.AdminVenueScope;
import com.campus.venue.audit.domain.VenueScopeStatus;
import com.campus.venue.audit.repository.AdminVenueScopeRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.dto.VenueIdListValidator;
import com.campus.venue.venue.service.VenueLookup;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 授权范围整体替换（docs/13 第 3.9 节，BE-6 U2、U4）。每个（管理员, 场馆）只有一行（唯一约束），所以替换是逐行更新：
 * <ul>
 *   <li>不在新列表中、当前 ACTIVE 的行置 REVOKED（其他列不动）；</li>
 *   <li>新列表中的场馆最终为 ACTIVE 且 valid_from、valid_to 为空（立即、长期有效）：新插入、由 REVOKED 重新启用、
 *       或有效期被清空的行，granted_by 为操作者、granted_at 取 Clock；已是 ACTIVE 且有效期为空的行不动；</li>
 *   <li>重复 id 去重。</li>
 * </ul>
 * 并发：调用方须先锁定目标管理员的用户行，同一管理员的替换由此串行。只在调用方的事务内使用（MANDATORY）。
 */
@Service
public class VenueScopeReplacer {

    private final AdminVenueScopeRepository scopes;
    private final VenueLookup venueLookup;
    private final Clock clock;

    public VenueScopeReplacer(AdminVenueScopeRepository scopes, VenueLookup venueLookup, Clock clock) {
        this.scopes = scopes;
        this.venueLookup = venueLookup;
        this.clock = clock;
    }

    /**
     * 有不存在的场馆 → VALIDATION_ERROR fields.venueIds（BE-6 U2、U4：在角色检查之后查库；mock 在格式阶段，API-SYNC）。
     */
    public void requireExistingVenues(Collection<Long> venueIds) {
        if (!venueLookup.allExist(venueIds)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    Map.of("fields", Map.of("venueIds", VenueIdListValidator.PROBLEM)));
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void replace(long adminId, Collection<Long> venueIds, long grantedBy) {
        Set<Long> desired = new LinkedHashSet<>(venueIds);
        Map<Long, AdminVenueScope> existing = scopes.findByAdminId(adminId).stream()
                .collect(Collectors.toMap(AdminVenueScope::getVenueId, Function.identity()));
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        List<AdminVenueScope> changed = new ArrayList<>();
        for (AdminVenueScope scope : existing.values()) {
            if (!desired.contains(scope.getVenueId()) && scope.getStatus() == VenueScopeStatus.ACTIVE) {
                scope.setStatus(VenueScopeStatus.REVOKED);
                changed.add(scope);
            }
        }
        for (Long venueId : desired) {
            AdminVenueScope scope = existing.get(venueId);
            if (scope == null) {
                scope = new AdminVenueScope();
                scope.setAdminId(adminId);
                scope.setVenueId(venueId);
            } else if (isPermanentlyActive(scope)) {
                continue;
            }
            scope.setStatus(VenueScopeStatus.ACTIVE);
            scope.setValidFrom(null);
            scope.setValidTo(null);
            scope.setGrantedBy(grantedBy);
            scope.setGrantedAt(now);
            changed.add(scope);
        }
        scopes.saveAllAndFlush(changed);
    }

    private static boolean isPermanentlyActive(AdminVenueScope scope) {
        return scope.getStatus() == VenueScopeStatus.ACTIVE && scope.getValidFrom() == null
                && scope.getValidTo() == null;
    }
}
