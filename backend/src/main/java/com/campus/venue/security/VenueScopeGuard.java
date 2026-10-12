package com.campus.venue.security;

import com.campus.venue.audit.domain.VenueScopeStatus;
import com.campus.venue.audit.repository.AdminVenueScopeRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 授权范围校验（BE-1 V1，docs/08 第 3 节）：对“当前用户 + venueId”裁决。
 * SYS_ADMIN 通过；VENUE_ADMIN 每次查库（不缓存）判断是否有当前有效授权，否则 FORBIDDEN_SCOPE；USER → FORBIDDEN。
 * 撤销或有效期结束后，下一次调用即失败。“今天”取注入的 Clock。
 */
@Component
public class VenueScopeGuard {

    private final AdminVenueScopeRepository scopes;
    private final Clock clock;

    public VenueScopeGuard(AdminVenueScopeRepository scopes, Clock clock) {
        this.scopes = scopes;
        this.clock = clock;
    }

    public void requireVenueAccess(AuthenticatedUser user, long venueId) {
        switch (user.role()) {
            case SYS_ADMIN -> {
                // 系统管理员不受场馆范围限制
            }
            case VENUE_ADMIN -> {
                if (!scopes.existsEffectiveScope(user.id(), venueId, VenueScopeStatus.ACTIVE, today())) {
                    throw new BusinessException(ErrorCode.FORBIDDEN_SCOPE, Map.of("venueId", venueId));
                }
            }
            default -> throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    /** 场馆管理员当前有效授权的场馆 id，升序。 */
    public List<Long> effectiveVenueIds(long adminId) {
        return scopes.findEffectiveVenueIds(adminId, VenueScopeStatus.ACTIVE, today());
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
