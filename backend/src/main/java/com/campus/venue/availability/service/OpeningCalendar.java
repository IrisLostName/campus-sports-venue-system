package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.service.SlotDerivation.ClosureScope;
import com.campus.venue.availability.service.SlotDerivation.SlotTime;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 若干场馆在一段日期 [from, to] 内的开放日历（BE-7 K3、D4）。每周窗口与关闭规则由 SlotDataReader.openingCalendar
 * 一次批量读入，按日期在内存中选取，条件与逐日读取的 weeklyFor、closuresCovering 相同（当天星期的 ACTIVE 每周窗口；
 * 开始日期 ≤ 当天 ≤ 结束日期的 ACTIVE 关闭）；切分、关闭范围与不可用判断调用 SlotDerivation，不另写一份。
 * 不查库、不取时钟。
 */
public final class OpeningCalendar {

    private final LocalDate from;
    private final LocalDate to;
    private final Map<Long, List<AvailabilityRule>> weeklyByVenue;
    private final Map<Long, List<AvailabilityRule>> closuresByVenue;

    /** weekly 为这些场馆的全部 ACTIVE 每周窗口；closures 为与 [from, to] 有交集的 ACTIVE 关闭。 */
    OpeningCalendar(LocalDate from, LocalDate to, List<AvailabilityRule> weekly, List<AvailabilityRule> closures) {
        this.from = from;
        this.to = to;
        this.weeklyByVenue = weekly.stream().collect(Collectors.groupingBy(AvailabilityRule::getVenueId));
        this.closuresByVenue = closures.stream().collect(Collectors.groupingBy(AvailabilityRule::getVenueId));
    }

    /**
     * K3：该场馆当天的开放时段数 = 各场地中不是“不可用”（SlotDerivation.unavailable：场馆或场地不是 OPEN、或被当天的
     * 关闭覆盖）的，每个计当天派生时段数。resources 为该场馆的场地。
     */
    public int openSlots(Venue venue, List<Resource> resources, LocalDate date) {
        int slots = slotsOn(venue.getId(), date).size();
        ClosureScope closures = closuresOn(venue.getId(), date);
        int total = 0;
        for (Resource resource : resources) {
            if (!SlotDerivation.unavailable(venue, resource, closures)) {
                total += slots;
            }
        }
        return total;
    }

    /** D4：当天是否有覆盖该场地的 ACTIVE 关闭（整馆或本场地）。 */
    public boolean closedByRule(Resource resource, LocalDate date) {
        return closuresOn(resource.getVenueId(), date).closes(resource);
    }

    /**
     * D4“当前时段”（FE-1 F2）：该场馆当天派生时段中包含 time 的 [start, end) 的结束时刻；time 不在任何派生时段内
     * （开馆前、窗口间空档、闭馆后）时为空。只看每周窗口，不看关闭与场地状态（与 mock deriveSlots 一致）。
     */
    public Optional<LocalTime> currentSlotEnd(long venueId, LocalDate date, LocalTime time) {
        return slotsOn(venueId, date).stream()
                .filter(slot -> !time.isBefore(slot.start()) && time.isBefore(slot.end()))
                .map(SlotTime::end)
                .findFirst();
    }

    private List<SlotTime> slotsOn(long venueId, LocalDate date) {
        requireLoaded(date);
        int weekday = date.getDayOfWeek().getValue();
        return SlotDerivation.slice(weeklyByVenue.getOrDefault(venueId, List.of()).stream()
                .filter(window -> window.getWeekday() == weekday)
                .toList());
    }

    private ClosureScope closuresOn(long venueId, LocalDate date) {
        requireLoaded(date);
        return SlotDerivation.closureScope(closuresByVenue.getOrDefault(venueId, List.of()).stream()
                .filter(closure -> !closure.getStartDate().isAfter(date) && !closure.getEndDate().isBefore(date))
                .toList());
    }

    /**
     * 只读入了 [from, to] 内的关闭规则，区间外的日期无从判断。调用方总是只问已读入区间内的日期（统计区间、大屏的近 7 天），
     * 所以越界是编程错误，任何接口都走不到这里（BE-7 裁决 P3）。
     */
    private void requireLoaded(LocalDate date) {
        if (date.isBefore(from) || date.isAfter(to)) {
            throw new IllegalArgumentException("日期 " + date + " 不在已读入的区间 [" + from + ", " + to + "] 内");
        }
    }
}
