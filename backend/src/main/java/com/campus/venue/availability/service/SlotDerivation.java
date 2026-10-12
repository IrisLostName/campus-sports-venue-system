package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.SlotStatus;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.service.BookingRulesService;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 时段派生的纯计算部分（docs/03 第 3、3.1 节，BE-2a D1–D3）。不查库、不取时钟，由 SlotService 传入数据与“现在”。
 * 做法与前端 mock slotDerivation.ts 一致（sliceWindow、deriveSlots、isClosedByRule、isUnavailable、resolveSlotStatus）。
 */
final class SlotDerivation {

    private SlotDerivation() {
    }

    /** 由开放窗口切出的一个时段 [start, end)。 */
    record SlotTime(LocalTime start, LocalTime end) {
    }

    /** 决定时段状态的三个事实：是否已开始、该时段的有效预约（可空）、是否不可用（关闭规则、维护、停用或场馆关闭）。 */
    record SlotFacts(boolean past, Reservation reservation, boolean unavailable) {
    }

    /** 当天生效的特殊关闭：整馆关闭，或只关闭若干场地。 */
    record ClosureScope(boolean wholeVenue, Set<Long> resourceIds) {

        boolean closes(Resource resource) {
            return wholeVenue || resourceIds.contains(resource.getId());
        }
    }

    /**
     * D1：每个窗口从 openTime 起每 90 分钟切一段，不足 90 分钟的零头不产生时段；全部时段按开始时间排序。
     * 调用方只传入该场馆当天星期的 ACTIVE 每周窗口。
     */
    static List<SlotTime> slice(List<AvailabilityRule> weekly) {
        List<SlotTime> slots = new ArrayList<>();
        for (AvailabilityRule window : weekly) {
            long minutes = Duration.between(window.getOpenTime(), window.getCloseTime()).toMinutes();
            long count = Math.max(minutes, 0) / BookingRulesService.SLOT_MINUTES;
            for (int k = 0; k < count; k++) {
                LocalTime start = window.getOpenTime().plusMinutes((long) BookingRulesService.SLOT_MINUTES * k);
                slots.add(new SlotTime(start, start.plusMinutes(BookingRulesService.SLOT_MINUTES)));
            }
        }
        slots.sort(Comparator.comparing(SlotTime::start));
        return slots;
    }

    /** D2：resourceId 为空的关闭作用于整馆，否则只作用于该场地。调用方只传入覆盖当天的 ACTIVE 关闭。 */
    static ClosureScope closureScope(List<AvailabilityRule> closures) {
        boolean wholeVenue = false;
        Set<Long> resourceIds = new HashSet<>();
        for (AvailabilityRule closure : closures) {
            if (closure.getResourceId() == null) {
                wholeVenue = true;
            } else {
                resourceIds.add(closure.getResourceId());
            }
        }
        return new ClosureScope(wholeVenue, resourceIds);
    }

    /** D2：场馆不是 OPEN、场地不是 OPEN、或被关闭覆盖 → 不可用。 */
    static boolean unavailable(Venue venue, Resource resource, ClosureScope closures) {
        return venue.getOperationalStatus() != VenueStatus.OPEN
                || resource.getOperationalStatus() != ResourceStatus.OPEN
                || closures.closes(resource);
    }

    /** D3：时段开始时刻不晚于现在即为 PAST（开始时刻正好等于现在也算）。 */
    static boolean isPast(LocalDate date, LocalTime start, LocalDateTime now) {
        return !LocalDateTime.of(date, start).isAfter(now);
    }

    /** D3 优先级：PAST > MINE/BOOKED > CLOSED > AVAILABLE（FE-1 裁决 A7）。viewerId 为 null 时（管理端）不会出现 MINE。 */
    static SlotStatus resolve(SlotFacts facts, Long viewerId) {
        if (facts.past()) {
            return SlotStatus.PAST;
        }
        if (facts.reservation() != null) {
            return facts.reservation().getUserId().equals(viewerId) ? SlotStatus.MINE : SlotStatus.BOOKED;
        }
        return facts.unavailable() ? SlotStatus.CLOSED : SlotStatus.AVAILABLE;
    }
}
