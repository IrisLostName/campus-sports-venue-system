package com.campus.venue.venue.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.reservation.service.AffectedScope;
import com.campus.venue.reservation.service.ImpactChangeService;
import com.campus.venue.reservation.service.ImpactPlan;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.dto.ResourceView;
import com.campus.venue.venue.dto.UpdateResourceRequest;
import com.campus.venue.venue.repository.ResourceRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 修改场地（docs/12 第 5.5 节，BE-2b 裁决 A2），与 mock resourceService.ts 的 updateResource 一致。
 * 认证、格式、REASON_REQUIRED、角色在过滤器与控制器完成；这里依次：场地不存在 NOT_FOUND → 锁定所属场馆行 →
 * 授权范围（按所属场馆）→ 同场馆重名 → 影响检查（状态确有变化且改为 MAINTENANCE/DISABLED 时）→ 执行；
 * 只有状态确有变化才写 RESOURCE_STATUS_CHANGE 日志（只改名称、排序不写，FE-1 裁决 §7-7）。
 */
@Service
public class ResourceAdminService {

    static final String RESOURCE_NAME_CONSTRAINT = "uq_resource_venue_name";
    /** 与 mock updateResource 的文案一致。 */
    static final String RESOURCE_NAME_TAKEN_MESSAGE = "同一场馆内场地名不能重复";

    private final ResourceRepository resources;
    private final VenueLookup venueLookup;
    private final VenueScopeGuard venueScopeGuard;
    private final ImpactChangeService impactChangeService;
    private final Clock clock;

    public ResourceAdminService(ResourceRepository resources, VenueLookup venueLookup,
            VenueScopeGuard venueScopeGuard, ImpactChangeService impactChangeService, Clock clock) {
        this.resources = resources;
        this.venueLookup = venueLookup;
        this.venueScopeGuard = venueScopeGuard;
        this.impactChangeService = impactChangeService;
        this.clock = clock;
    }

    @Transactional
    public ImpactChangeResponse<ResourceView> update(AuthenticatedUser user, long resourceId,
            UpdateResourceRequest request) {
        // 先只取所属场馆 id，锁定场馆行之后再读取场地，读到的是锁定后的最新值（裁决 G8）
        long venueId = resources.findVenueIdById(resourceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Venue venue = venueLookup.lockForUpdate(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        Resource resource = resources.findById(resourceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (request.name() != null
                && resources.existsByVenueIdAndNameAndIdNot(venue.getId(), request.name(), resource.getId())) {
            throw nameTaken();
        }
        ResourceStatus target = request.operationalStatus() == null ? null
                : ResourceStatus.valueOf(request.operationalStatus());
        boolean statusChange = target != null && target != resource.getOperationalStatus();
        boolean unavailable = target == ResourceStatus.MAINTENANCE || target == ResourceStatus.DISABLED;
        AffectedScope scope = statusChange && unavailable
                ? AffectedScope.resources(List.of(resource.getId()))
                : AffectedScope.none();
        ResourceView before = VenueService.toView(resource);
        return impactChangeService.apply(user, request, scope, new ImpactPlan<>(venue.getId(),
                statusChange ? LogAction.RESOURCE_STATUS_CHANGE : null, before, ResourceView::id,
                () -> commit(resource, request, target)));
    }

    private ResourceView commit(Resource resource, UpdateResourceRequest request, ResourceStatus target) {
        if (request.name() != null) {
            resource.setName(request.name());
        }
        if (request.sortOrder() != null) {
            resource.setSortOrder(request.sortOrder());
        }
        if (target != null) {
            resource.setOperationalStatus(target);
        }
        resource.setUpdatedAt(now());
        saveCheckingName(List.of(resource));
        return VenueService.toView(resource);
    }

    /** 保存并立即写库；同场馆重名的唯一冲突（含并发）→ VALIDATION_ERROR，其他约束错误照常抛出。 */
    void saveCheckingName(List<Resource> changed) {
        try {
            resources.saveAllAndFlush(changed);
        } catch (DataIntegrityViolationException ex) {
            if (UniqueViolations.isViolationOf(ex, RESOURCE_NAME_CONSTRAINT)) {
                throw nameTaken();
            }
            throw ex;
        }
    }

    LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }

    private static BusinessException nameTaken() {
        return new BusinessException(ErrorCode.VALIDATION_ERROR,
                Map.of("fields", Map.of("name", RESOURCE_NAME_TAKEN_MESSAGE)));
    }
}
