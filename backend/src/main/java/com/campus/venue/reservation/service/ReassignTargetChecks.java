package com.campus.venue.reservation.service;

import com.campus.venue.availability.service.SlotService;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.dto.ReassignResourceRequest;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 两类改派的目标检查（docs/10 第 6 节、docs/12 第 5.7 节，BE-5 A3、A4），在 AdminOverrideGuard 的前置检查之后执行。
 * 目标场馆、场地、规则、目标用户均不加锁（BE-5 C3）；资源改派的最终保证是部分唯一索引。事务由调用方提供。
 */
@Component
public class ReassignTargetChecks {

    private final ResourceRepository resources;
    private final VenueRepository venues;
    private final ReservationRepository reservations;
    private final AppUserRepository users;
    private final SlotService slotService;
    private final ReservationCreationChecks creationChecks;

    public ReassignTargetChecks(ResourceRepository resources, VenueRepository venues,
            ReservationRepository reservations, AppUserRepository users, SlotService slotService,
            ReservationCreationChecks creationChecks) {
        this.resources = resources;
        this.venues = venues;
        this.reservations = reservations;
        this.users = users;
        this.slotService = slotService;
        this.creationChecks = creationChecks;
    }

    /**
     * A3，与 mock 的 checkResourceTarget 顺序一致：目标场地不存在或不属于原预约所在场馆 → SLOT_NOT_AVAILABLE；
     * 不是派生时段、场馆或场地不是 OPEN、或在关闭规则内 → SLOT_NOT_AVAILABLE（不受 advanceDays 与 userBookingEnabled 限制）；
     * 开始时刻不晚于现在 → SLOT_IN_PAST；目标时段已有其他有效预约（排除预约自身）→ SLOT_TAKEN。
     */
    public void resourceTarget(Reservation reservation, long venueId, ReassignResourceRequest request,
            LocalDateTime now) {
        Optional<Resource> target = resources.findById(request.resourceId())
                .filter(resource -> resource.getVenueId() == venueId);
        Optional<Venue> venue = venues.findById(venueId);
        if (target.isEmpty() || venue.isEmpty() || !slotService.isAssignableSlot(venue.get(), target.get(),
                request.serviceDate(), request.startTime())) {
            throw new BusinessException(ErrorCode.SLOT_NOT_AVAILABLE);
        }
        creationChecks.notPast(request.serviceDate(), request.startTime(), now);
        if (reservations.existsByResourceIdAndServiceDateAndStartTimeAndStatusNotInAndIdNot(request.resourceId(),
                request.serviceDate(), request.startTime(), ReservationCreationChecks.INACTIVE,
                reservation.getId())) {
            throw new BusinessException(ErrorCode.SLOT_TAKEN);
        }
    }

    /**
     * A4，与 mock 的 reassignUser 一致：目标用户不存在、角色不是 USER、或账号不是 ACTIVE → USER_NOT_ELIGIBLE。
     * 不校验目标用户的持有上限（管理员覆盖优先，由日志留痕，docs/10 第 6 节）。
     */
    public AppUser userTarget(long userId) {
        return users.findById(userId)
                .filter(user -> user.getRole() == Role.USER && user.getStatus() == AccountStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_ELIGIBLE));
    }
}
