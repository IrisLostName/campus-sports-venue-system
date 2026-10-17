package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.SlotStatus;
import com.campus.venue.availability.service.SlotDerivation.ClosureScope;
import com.campus.venue.availability.service.SlotDerivation.SlotFacts;
import com.campus.venue.availability.service.SlotDerivation.SlotTime;
import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.service.DisplayStatusCalculator;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.service.VenueLookup;
import com.campus.venue.venue.dto.Occupancy;
import com.campus.venue.venue.dto.OccupancyReservation;
import com.campus.venue.venue.dto.OccupancyResource;
import com.campus.venue.venue.dto.OccupancySlot;
import com.campus.venue.venue.dto.ResourceSlots;
import com.campus.venue.venue.dto.SlotItem;
import com.campus.venue.venue.dto.VenueSlots;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 时段派生（BE-2a D1–D4）：用户端时段与管理端占用总览共用 deriveDay，不两处各写一遍。
 * 数据由 SlotDataReader 按固定次数查询读取；“现在”每个请求只取一次 Clock。
 */
@Service
public class SlotService {

    private final SlotDataReader reader;
    private final VenueLookup venueLookup;
    private final VenueScopeGuard venueScopeGuard;
    private final DisplayStatusCalculator displayStatusCalculator;
    private final BookingProperties properties;
    private final Clock clock;

    public SlotService(SlotDataReader reader, VenueLookup venueLookup, VenueScopeGuard venueScopeGuard,
            DisplayStatusCalculator displayStatusCalculator, BookingProperties properties, Clock clock) {
        this.reader = reader;
        this.venueLookup = venueLookup;
        this.venueScopeGuard = venueScopeGuard;
        this.displayStatusCalculator = displayStatusCalculator;
        this.properties = properties;
        this.clock = clock;
    }

    /** 某场地当天的一个派生时段；reservation 为该时段的有效预约（可空）。 */
    record DerivedSlot(LocalTime start, LocalTime end, SlotStatus status, Reservation reservation) {
    }

    /** 某场地及其当天的派生时段。 */
    record ResourceDay(Resource resource, List<DerivedSlot> slots) {
    }

    /**
     * A2 用户端时段：场馆不存在 NOT_FOUND → 不可预约 VENUE_NOT_BOOKABLE → 日期不在 [今天, 今天+advanceDays)
     * DATE_OUT_OF_RANGE（details.advanceDays，早于今天同样）。只含非 DISABLED 的场地；MINE 依据当前用户。
     */
    @Transactional(readOnly = true)
    public VenueSlots userSlots(AuthenticatedUser user, long venueId, LocalDate date) {
        Venue venue = venueLookup.require(venueId);
        if (venue.getOperationalStatus() != VenueStatus.OPEN || !venue.isUserBookingEnabled()) {
            throw new BusinessException(ErrorCode.VENUE_NOT_BOOKABLE);
        }
        LocalDateTime now = LocalDateTime.now(clock);
        requireWithinAdvance(date, now.toLocalDate());
        List<Resource> visible = reader.resourcesOf(venue.getId()).stream()
                .filter(resource -> resource.getOperationalStatus() != ResourceStatus.DISABLED)
                .toList();
        List<ResourceSlots> result = deriveDay(venue, visible, date, now, user.id()).stream()
                .map(day -> new ResourceSlots(day.resource().getId(), day.resource().getName(),
                        day.resource().getOperationalStatus(), day.slots().stream()
                                .map(slot -> new SlotItem(slot.start(), slot.end(), slot.status()))
                                .toList()))
                .toList();
        return new VenueSlots(venue.getId(), venue.getName(), date, result);
    }

    /**
     * A6 占用总览：场馆不存在 NOT_FOUND → 授权范围 FORBIDDEN_SCOPE；不限制日期范围。
     * 列出全部场地（含 DISABLED）；管理端视角没有 MINE（viewerId 为 null）；存在有效预约即填 reservation。
     */
    @Transactional(readOnly = true)
    public Occupancy occupancy(AuthenticatedUser user, long venueId, LocalDate date) {
        Venue venue = venueLookup.require(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        LocalDateTime now = LocalDateTime.now(clock);
        List<Resource> all = reader.resourcesOf(venue.getId());
        List<ResourceDay> days = deriveDay(venue, all, date, now, null);
        List<Reservation> booked = days.stream()
                .flatMap(day -> day.slots().stream())
                .map(DerivedSlot::reservation)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, String> names = reader.displayNames(booked.stream().map(Reservation::getUserId).distinct().toList());
        Map<Long, UsageRecord> usage = reader.usageByReservation(booked.stream().map(Reservation::getId).toList());
        long resourceCount = all.stream()
                .filter(resource -> resource.getOperationalStatus() != ResourceStatus.DISABLED)
                .count();
        List<OccupancyResource> result = days.stream()
                .map(day -> new OccupancyResource(day.resource().getId(), day.resource().getName(),
                        day.resource().getOperationalStatus(), day.slots().stream()
                                .map(slot -> occupancySlot(slot, names, usage, now))
                                .toList()))
                .toList();
        return new Occupancy(venue.getId(), venue.getName(), date, resourceCount, result);
    }

    /** D1–D3：对给定场地派生当天全部时段及状态。viewerId 为 null 表示管理端视角。 */
    List<ResourceDay> deriveDay(Venue venue, List<Resource> list, LocalDate date, LocalDateTime now, Long viewerId) {
        List<SlotTime> slots = SlotDerivation.slice(reader.weeklyFor(venue.getId(), date));
        ClosureScope closures = SlotDerivation.closureScope(reader.closuresCovering(venue.getId(), date));
        // 部分唯一索引保证同一“场地 + 日期 + 开始时间”至多一条有效预约
        Map<String, Reservation> active = reader.activeReservations(list.stream().map(Resource::getId).toList(), date)
                .stream()
                .collect(Collectors.toMap(r -> key(r.getResourceId(), r.getStartTime()), Function.identity()));
        return list.stream()
                .map(resource -> new ResourceDay(resource, slots.stream()
                        .map(slot -> {
                            Reservation reservation = active.get(key(resource.getId(), slot.start()));
                            SlotFacts facts = new SlotFacts(SlotDerivation.isPast(date, slot.start(), now),
                                    reservation, SlotDerivation.unavailable(venue, resource, closures));
                            return new DerivedSlot(slot.start(), slot.end(),
                                    SlotDerivation.resolve(facts, viewerId), reservation);
                        })
                        .toList()))
                .toList();
    }

    /**
     * 创建预约第 5 步（BE-3 C2，复用 D1、D2）：start 是该场馆当天 ACTIVE 每周窗口派生出的时段开始时刻，
     * 且当天没有覆盖该场地的 ACTIVE 关闭（整馆或本场地）。场馆、场地状态由第 2、3 步检查，不在这里。
     * 与 mock 的 stepDerivedSlot（isDerivedSlot、isClosedByRule）一致。事务由调用方提供。
     */
    public boolean isOpenSlot(Venue venue, Resource resource, LocalDate date, LocalTime start) {
        boolean derived = SlotDerivation.slice(reader.weeklyFor(venue.getId(), date)).stream()
                .anyMatch(slot -> slot.start().equals(start));
        return derived && !SlotDerivation.closureScope(reader.closuresCovering(venue.getId(), date)).closes(resource);
    }

    /**
     * 资源改派的目标时段（docs/12 第 5.7 节，BE-5 A3，复用 D1、D2）：start 是该场馆当天 ACTIVE 每周窗口派生出的时段，
     * 场馆与场地均为 OPEN，且当天没有覆盖该场地的 ACTIVE 关闭。不看 advanceDays 与 userBookingEnabled。
     * 与 mock 的 checkResourceTarget（isDerivedSlot、isUnavailable、isClosedByRule）一致。事务由调用方提供。
     */
    public boolean isAssignableSlot(Venue venue, Resource resource, LocalDate date, LocalTime start) {
        boolean derived = SlotDerivation.slice(reader.weeklyFor(venue.getId(), date)).stream()
                .anyMatch(slot -> slot.start().equals(start));
        ClosureScope closures = SlotDerivation.closureScope(reader.closuresCovering(venue.getId(), date));
        return derived && !SlotDerivation.unavailable(venue, resource, closures);
    }

    /** 可预约日期为 [今天, 今天 + advanceDays)，否则 DATE_OUT_OF_RANGE（用户端时段与创建预约第 4 步共用）。 */
    public void requireWithinAdvance(LocalDate date, LocalDate today) {
        if (date.isBefore(today) || !date.isBefore(today.plusDays(properties.advanceDays()))) {
            throw new BusinessException(ErrorCode.DATE_OUT_OF_RANGE, Map.of("advanceDays", properties.advanceDays()));
        }
    }

    private static String key(long resourceId, LocalTime start) {
        return resourceId + "@" + start;
    }

    private OccupancySlot occupancySlot(DerivedSlot slot, Map<Long, String> names, Map<Long, UsageRecord> usage,
            LocalDateTime now) {
        Reservation reservation = slot.reservation();
        OccupancyReservation brief = reservation == null ? null
                : new OccupancyReservation(reservation.getId(), names.get(reservation.getUserId()),
                        displayStatusCalculator.of(reservation, usage.get(reservation.getId()), now));
        return new OccupancySlot(slot.start(), slot.end(), slot.status(), brief);
    }
}
