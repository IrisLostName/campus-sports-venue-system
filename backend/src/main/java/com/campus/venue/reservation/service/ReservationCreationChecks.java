package com.campus.venue.reservation.service;

import com.campus.venue.availability.service.SlotService;
import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 创建预约的第 2–8 步（docs/10 第 1 节，BE-3 C2），一步一个方法，任一步失败即抛出、后续不执行；
 * 调用顺序由 ReservationService.create 决定。与 mock 的 reservationRules.ts（stepBookableVenue … stepSlotFree）一致。
 * 事务由调用方提供。
 */
@Component
public class ReservationCreationChecks {

    /** 不占用时段的预约状态（docs/03 第 4.1 节；与部分唯一索引条件一致）。 */
    static final List<ReservationStatus> INACTIVE =
            List.of(ReservationStatus.CANCELLED, ReservationStatus.ADMIN_CANCELLED);

    private final ResourceRepository resources;
    private final VenueRepository venues;
    private final ReservationRepository reservations;
    private final SlotService slotService;
    private final HeldReservations heldReservations;
    private final BookingProperties properties;

    public ReservationCreationChecks(ResourceRepository resources, VenueRepository venues,
            ReservationRepository reservations, SlotService slotService, HeldReservations heldReservations,
            BookingProperties properties) {
        this.resources = resources;
        this.venues = venues;
        this.reservations = reservations;
        this.slotService = slotService;
        this.heldReservations = heldReservations;
        this.properties = properties;
    }

    /** 预约目标：场地及其所属场馆。 */
    public record Target(Resource resource, Venue venue) {
    }

    /** 第 2 步：场地存在，所属场馆 OPEN 且 userBookingEnabled → 否则 VENUE_NOT_BOOKABLE（场地不存在也是它，FE-1 裁决 §7-1）。 */
    public Target bookableTarget(long resourceId) {
        Optional<Resource> resource = resources.findById(resourceId);
        Optional<Venue> venue = resource.flatMap(found -> venues.findById(found.getVenueId()));
        if (venue.isEmpty() || venue.get().getOperationalStatus() != VenueStatus.OPEN
                || !venue.get().isUserBookingEnabled()) {
            throw new BusinessException(ErrorCode.VENUE_NOT_BOOKABLE);
        }
        return new Target(resource.get(), venue.get());
    }

    /** 第 3 步：场地状态为 OPEN → 否则 RESOURCE_UNAVAILABLE（MAINTENANCE、DISABLED 均是）。 */
    public void resourceOpen(Resource resource) {
        if (resource.getOperationalStatus() != ResourceStatus.OPEN) {
            throw new BusinessException(ErrorCode.RESOURCE_UNAVAILABLE);
        }
    }

    /** 第 4 步：serviceDate ∈ [今天, 今天 + advanceDays) → 否则 DATE_OUT_OF_RANGE（details.advanceDays）。 */
    public void dateInRange(LocalDate serviceDate, LocalDate today) {
        slotService.requireWithinAdvance(serviceDate, today);
    }

    /** 第 5 步：是当天派生出的时段且不在关闭规则内 → 否则 SLOT_NOT_AVAILABLE（复用 BE-2a 派生）。 */
    public void derivedSlot(Target target, LocalDate serviceDate, LocalTime startTime) {
        if (!slotService.isOpenSlot(target.venue(), target.resource(), serviceDate, startTime)) {
            throw new BusinessException(ErrorCode.SLOT_NOT_AVAILABLE);
        }
    }

    /** 第 6 步：开始时刻晚于现在 → 否则 SLOT_IN_PAST（正好等于现在也失败，与 BE-2a 的 PAST 一致）。 */
    public void notPast(LocalDate serviceDate, LocalTime startTime, LocalDateTime now) {
        if (!LocalDateTime.of(serviceDate, startTime).isAfter(now)) {
            throw new BusinessException(ErrorCode.SLOT_IN_PAST);
        }
    }

    /** 第 7 步：当前持有数 < maxActiveReservationsPerUser → 否则 BOOKING_LIMIT_REACHED（details.max）。调用前须已锁定用户行（C4）。 */
    public void underLimit(long userId, LocalDateTime now) {
        if (heldReservations.of(userId, now).size() >= properties.maxActivePerUser()) {
            throw new BusinessException(ErrorCode.BOOKING_LIMIT_REACHED, Map.of("max", properties.maxActivePerUser()));
        }
    }

    /** 第 8 步：该时段没有有效预约（前置检查，给友好提示）→ 否则 SLOT_TAKEN。最终保证是部分唯一索引。 */
    public void slotFree(long resourceId, LocalDate serviceDate, LocalTime startTime) {
        if (reservations.existsByResourceIdAndServiceDateAndStartTimeAndStatusNotIn(resourceId, serviceDate,
                startTime, INACTIVE)) {
            throw new BusinessException(ErrorCode.SLOT_TAKEN);
        }
    }
}
