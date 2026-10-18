package com.campus.venue.stats.service;

import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.announcement.repository.AnnouncementRepository;
import com.campus.venue.stats.domain.ResourceLiveState;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.stats.dto.DisplaySummary;
import com.campus.venue.stats.dto.DisplaySummary.Notice;
import com.campus.venue.stats.dto.DisplaySummary.ResourceBoard;
import com.campus.venue.stats.dto.DisplaySummary.TrendPoint;
import com.campus.venue.stats.dto.DisplaySummary.VenueBoard;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 大屏聚合（docs/12 第 5.10 节，BE-7 D1–D8），与 mock statsService.ts 的 getDisplaySummary 一致。公开接口，
 * 范围为全部场馆、不受任何授权影响；数字全部来自 StatsCalculator（与管理端总览同一口径）。
 * 语句至多 11 条：全部场馆 1 条、统计至多 9 条、公告 1 条，不随场地与预约数增加（大屏每 30 秒轮询）。
 */
@Service
public class DisplaySummaryService {

    /** 公告最多 5 条（mock NOTICE_LIMIT）。 */
    static final int NOTICE_LIMIT = 5;

    private final StatsCalculator calculator;
    private final LiveStateResolver liveStates;
    private final VenueRepository venues;
    private final AnnouncementRepository announcements;
    private final Clock clock;

    public DisplaySummaryService(StatsCalculator calculator, LiveStateResolver liveStates, VenueRepository venues,
            AnnouncementRepository announcements, Clock clock) {
        this.calculator = calculator;
        this.liveStates = liveStates;
        this.venues = venues;
        this.announcements = announcements;
        this.clock = clock;
    }

    /** 某场地与其实时状态。 */
    private record LiveResource(Resource resource, ResourceLiveState state) {
    }

    /** D2–D6：统计区间为含今天的近 7 天，今天的数字与 weekTrend 取自同一次计算。 */
    @Transactional(readOnly = true)
    public DisplaySummary summary() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        List<Venue> all = venues.findAllByOrderByIdAsc();
        StatsPeriod week = StatsPeriod.recent(today);
        StatsFigures figures = calculator.compute(all, week, now);
        Map<Long, Venue> byId = all.stream().collect(Collectors.toMap(Venue::getId, Function.identity()));
        List<LiveResource> live = figures.resources().stream()
                .map(resource -> new LiveResource(resource,
                        liveStates.stateOf(byId.get(resource.getVenueId()), resource, figures, now)))
                .toList();
        List<TrendPoint> trend = week.dates().stream()
                .map(date -> new TrendPoint(date, figures.reservationCountOn(date)))
                .toList();
        return new DisplaySummary(now, figures.reservationCountOn(today), figures.currentInUse(),
                figures.utilizationRateOn(today), all.stream().map(venue -> board(venue, live)).toList(),
                live.stream().map(DisplaySummaryService::resourceBoard).toList(), trend, notices(now));
    }

    /** D3：resourceOpen 只看场地状态，不看场馆状态与关闭规则（与 mock 一致，API-SYNC 观察项）。 */
    private static VenueBoard board(Venue venue, List<LiveResource> live) {
        List<LiveResource> own = live.stream()
                .filter(entry -> entry.resource().getVenueId().equals(venue.getId()))
                .toList();
        long total = own.stream().filter(entry -> entry.state() != ResourceLiveState.DISABLED).count();
        long open = own.stream()
                .filter(entry -> entry.resource().getOperationalStatus() == ResourceStatus.OPEN)
                .count();
        long reservedNow = own.stream()
                .filter(entry -> entry.state() == ResourceLiveState.RESERVED || entry.state() == ResourceLiveState.IN_USE)
                .count();
        return new VenueBoard(venue.getId(), venue.getName(), venue.getOperationalStatus(),
                venue.isUserBookingEnabled(), total, open, reservedNow);
    }

    private static ResourceBoard resourceBoard(LiveResource entry) {
        Resource resource = entry.resource();
        return new ResourceBoard(resource.getVenueId(), resource.getId(), resource.getName(), entry.state());
    }

    /** D6：复用 BE-6 的有效公告查询（ACTIVE 且未过期，按发布时间、id 倒序），取前 5 条，只含 id 与标题。 */
    private List<Notice> notices(LocalDateTime now) {
        return announcements.findLiveByScope(AnnouncementScope.SYSTEM, AnnouncementStatus.ACTIVE, now).stream()
                .limit(NOTICE_LIMIT)
                .map(announcement -> new Notice(announcement.getId(), announcement.getTitle()))
                .toList();
    }
}
