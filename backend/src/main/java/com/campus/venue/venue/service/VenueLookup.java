package com.campus.venue.venue.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.VenueRepository;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 按 id 取场馆，不存在 → NOT_FOUND（BE-2a N4：场馆读取、时段派生、开放规则与 BE-2b 管理变更共用这一处）。
 * 事务由调用方提供。
 */
@Component
public class VenueLookup {

    private final VenueRepository venues;
    private final VenueScopeGuard venueScopeGuard;

    public VenueLookup(VenueRepository venues, VenueScopeGuard venueScopeGuard) {
        this.venues = venues;
        this.venueScopeGuard = venueScopeGuard;
    }

    public Venue require(long venueId) {
        return venues.findById(venueId).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /** 给定的场馆 id 是否全部存在（重复 id 只算一次；一次查询，空集合不发查询）。BE-6 U2、U4。 */
    public boolean allExist(Collection<Long> venueIds) {
        Set<Long> distinct = new HashSet<>(venueIds);
        return distinct.isEmpty() || venues.findAllById(distinct).size() == distinct.size();
    }

    /**
     * 锁定场馆行（SELECT … FOR UPDATE），不存在 → NOT_FOUND。BE-2b 每个管理变更先调用它，
     * 使同一场馆的变更串行；全系统加锁顺序为 用户行 → 场馆行 → 预约行（BE-2b 裁决 G8）。
     */
    public Venue lockForUpdate(long venueId) {
        return venues.lockById(venueId).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /** 锁定场馆行（NOT_FOUND）后检查授权范围（FORBIDDEN_SCOPE），即 G1 的“对象不存在 → 授权范围”。 */
    public Venue lockForAdmin(AuthenticatedUser user, long venueId) {
        Venue venue = lockForUpdate(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        return venue;
    }
}
