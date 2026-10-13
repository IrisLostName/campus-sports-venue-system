package com.campus.venue.venue.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.reservation.service.AffectedScope;
import com.campus.venue.reservation.service.ImpactChangeService;
import com.campus.venue.reservation.service.ImpactPlan;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.domain.VenueType;
import com.campus.venue.venue.dto.UpdateVenueRequest;
import com.campus.venue.venue.dto.VenueSummary;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 修改场馆（docs/12 第 5.5 节，BE-2b 裁决 A1），与 mock resourceService.ts 的 updateVenue 一致。
 * 认证、格式、REASON_REQUIRED、角色在过滤器与控制器完成；这里依次：VA 提交 SA 专属字段 FORBIDDEN → 锁定场馆行
 * （NOT_FOUND）→ 授权范围 → 场馆重名 → 影响检查（仅 OPEN 改为 CLOSED 时）→ 执行并写 VENUE_UPDATE 日志。
 */
@Service
public class VenueAdminService {

    private final VenueRepository venues;
    private final ResourceRepository resources;
    private final VenueLookup venueLookup;
    private final VenueScopeGuard venueScopeGuard;
    private final ImpactChangeService impactChangeService;
    private final Clock clock;

    public VenueAdminService(VenueRepository venues, ResourceRepository resources, VenueLookup venueLookup,
            VenueScopeGuard venueScopeGuard, ImpactChangeService impactChangeService, Clock clock) {
        this.venues = venues;
        this.resources = resources;
        this.venueLookup = venueLookup;
        this.venueScopeGuard = venueScopeGuard;
        this.impactChangeService = impactChangeService;
        this.clock = clock;
    }

    @Transactional
    public ImpactChangeResponse<VenueSummary> update(AuthenticatedUser user, long venueId,
            UpdateVenueRequest request) {
        // 场馆管理员只能改 description（docs/03 第 7 节、docs/12 第 5.5 节），在 NOT_FOUND 之前（与 mock 一致）
        if (user.role() == Role.VENUE_ADMIN && request.touchesSysAdminFields()) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        Venue venue = venueLookup.lockForUpdate(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        if (request.name() != null && venues.existsByNameAndIdNot(request.name(), venue.getId())) {
            throw VenueService.nameTaken();
        }
        // userBookingEnabled 的变化不做影响检查（FE-1 裁决 A9）；已是 CLOSED 再提交 CLOSED 也不做（与 mock 一致）
        boolean closing = VenueStatus.CLOSED.name().equals(request.operationalStatus())
                && venue.getOperationalStatus() != VenueStatus.CLOSED;
        AffectedScope scope = closing ? AffectedScope.resources(resourceIdsOf(venue)) : AffectedScope.none();
        VenueSummary before = summary(venue);
        return impactChangeService.apply(user, request, scope, new ImpactPlan<>(venue.getId(),
                LogAction.VENUE_UPDATE, before, VenueSummary::id, () -> commit(venue, request)));
    }

    private VenueSummary commit(Venue venue, UpdateVenueRequest request) {
        if (request.name() != null) {
            venue.setName(request.name());
        }
        if (request.venueType() != null) {
            venue.setVenueType(VenueType.valueOf(request.venueType()));
        }
        if (request.location() != null) {
            venue.setLocation(request.location());
        }
        if (request.description() != null) {
            venue.setDescription(request.description());
        }
        if (request.operationalStatus() != null) {
            venue.setOperationalStatus(VenueStatus.valueOf(request.operationalStatus()));
        }
        if (request.userBookingEnabled() != null) {
            venue.setUserBookingEnabled(request.userBookingEnabled());
        }
        venue.setUpdatedAt(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        try {
            venues.saveAndFlush(venue);
        } catch (DataIntegrityViolationException ex) {
            if (VenueService.isNameConflict(ex)) {
                throw VenueService.nameTaken();
            }
            throw ex;
        }
        return summary(venue);
    }

    private List<Long> resourceIdsOf(Venue venue) {
        return resources.findByVenueIdOrderBySortOrderAscIdAsc(venue.getId()).stream().map(Resource::getId).toList();
    }

    private VenueSummary summary(Venue venue) {
        return VenueService.toSummary(venue,
                resources.countByVenueIdAndOperationalStatusNot(venue.getId(), ResourceStatus.DISABLED));
    }
}
