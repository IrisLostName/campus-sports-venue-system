package com.campus.venue.stats.service;

import com.campus.venue.availability.service.OpeningCalendar;
import com.campus.venue.availability.service.SlotDataReader;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.AdminReservationFilter;
import com.campus.venue.reservation.service.DisplayStatusCalculator;
import com.campus.venue.reservation.service.OverdueReservations;
import com.campus.venue.reservation.service.OverdueReservations.Overdue;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.stats.repository.ReservationStatsRepository.StatusCount;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 统计口径的唯一实现（BE-7 第 2 节；docs/03 第 8 节末句“大屏与管理端使用同一份统计服务”，FE-1 F1）：
 * 管理端总览与大屏都只调用 compute，接口层只组装结果。日期一律为 Clock 时区的本地日期，now 由调用方每个请求取一次。
 * 每次至多 9 条语句（S1 场地、S2/S3 聚合、S4/S5 开放日历、S6/S7 越过判定点的候选、S8/S9 今天的有效预约），
 * 不随区间天数、场地数或预约数增加；venues 为空时不发任何查询。事务由调用方提供。
 */
@Component
public class StatsCalculator {

    private final StatsDataReader reader;
    private final SlotDataReader slotDataReader;
    private final OverdueReservations overdueReservations;
    private final DisplayStatusCalculator calculator;

    public StatsCalculator(StatsDataReader reader, SlotDataReader slotDataReader,
            OverdueReservations overdueReservations, DisplayStatusCalculator calculator) {
        this.reader = reader;
        this.slotDataReader = slotDataReader;
        this.overdueReservations = overdueReservations;
        this.calculator = calculator;
    }

    /** venues 为统计范围内的场馆；period 已通过天数检查。 */
    public StatsFigures compute(List<Venue> venues, StatsPeriod period, LocalDateTime now) {
        List<Long> venueIds = venues.stream().map(Venue::getId).toList();
        OpeningCalendar calendar = slotDataReader.openingCalendar(venueIds, period.from(), period.to());
        if (venueIds.isEmpty()) {
            return new StatsFigures(new PeriodCounts(), new TodayFacts(List.of(), calendar, Map.of(), 0));
        }
        List<Resource> resources = reader.resourcesOf(venueIds);
        PeriodCounts counts = new PeriodCounts();
        for (StatusCount row : reader.createdCounts(venueIds, period)) {
            counts.created(row.getVenueId(), row.getStatDate(), row.getStatus(), row.getTotal());
        }
        for (StatusCount row : reader.serviceCounts(venueIds, period)) {
            counts.served(row.getVenueId(), row.getStatDate(), row.getStatus(), row.getTotal());
        }
        countOpenSlots(counts, venues, resources, calendar, period);
        // K7：库中 CONFIRMED 而有效状态已是 NO_SHOW / COMPLETED 的，用 BE-5 的候选集做法判定（不在 SQL 里复写判定点）
        Overdue overdue = overdueReservations.find(
                new AdminReservationFilter(venueIds, period.from(), period.to(), null, null), now);
        counts.overdue(overdue.noShow().size(), overdue.completed().size());
        return new StatsFigures(counts, todayFacts(resources, calendar, now));
    }

    /** K3：每个场馆、每一天的开放时段数，由开放日历按 SlotDerivation 计算（docs/13 第 4 节：不在 SQL 里重复实现）。 */
    private static void countOpenSlots(PeriodCounts counts, List<Venue> venues, List<Resource> resources,
            OpeningCalendar calendar, StatsPeriod period) {
        Map<Long, List<Resource>> byVenue = resources.stream().collect(Collectors.groupingBy(Resource::getVenueId));
        for (Venue venue : venues) {
            List<Resource> own = byVenue.getOrDefault(venue.getId(), List.of());
            for (LocalDate date : period.dates()) {
                counts.open(venue.getId(), date, calendar.openSlots(venue, own, date));
            }
        }
    }

    /** S8、S9：今天的有效预约及其使用记录与有效状态；K5 = 其中满足 LiveRules.inUse 的数量。 */
    private TodayFacts todayFacts(List<Resource> resources, OpeningCalendar calendar, LocalDateTime now) {
        List<Reservation> active = reader.activeOn(resources.stream().map(Resource::getId).toList(),
                now.toLocalDate());
        Map<Long, UsageRecord> usage = reader.usageOf(active.stream().map(Reservation::getId).toList());
        Map<Long, List<LiveReservation>> byResource = new HashMap<>();
        long inUse = 0;
        for (Reservation reservation : active) {
            UsageRecord record = usage.get(reservation.getId());
            LiveReservation live = new LiveReservation(reservation, record,
                    calculator.effectiveStatus(reservation, record, now));
            byResource.computeIfAbsent(reservation.getResourceId(), id -> new ArrayList<>()).add(live);
            if (LiveRules.inUse(live, now.toLocalTime())) {
                inUse++;
            }
        }
        return new TodayFacts(resources, calendar, byResource, inUse);
    }
}
