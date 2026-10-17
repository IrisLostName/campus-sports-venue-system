package com.campus.venue.stats.service;

import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.stats.dto.StatsOverview;
import com.campus.venue.stats.dto.StatsOverview.DailyStats;
import com.campus.venue.stats.dto.StatsOverview.VenueStats;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.VenueRepository;
import com.campus.venue.venue.service.VenueLookup;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 管理端统计总览（docs/12 第 5.10 节，BE-7 O1–O3），与 mock statsService.ts 的 getStatsOverview、scopedVenues 一致。
 * 格式、区间天数与角色在控制器完成；这里确定场馆范围后只组装 StatsCalculator 的结果。
 */
@Service
public class StatsOverviewService {

    private final StatsCalculator calculator;
    private final VenueScopeGuard venueScopeGuard;
    private final VenueLookup venueLookup;
    private final VenueRepository venues;
    private final Clock clock;

    public StatsOverviewService(StatsCalculator calculator, VenueScopeGuard venueScopeGuard, VenueLookup venueLookup,
            VenueRepository venues, Clock clock) {
        this.calculator = calculator;
        this.venueScopeGuard = venueScopeGuard;
        this.venueLookup = venueLookup;
        this.venues = venues;
        this.clock = clock;
    }

    /** dateFrom、dateTo 为请求原值（可缺省），已通过天数检查；缺省区间在这里按同一个 now 补上。 */
    @Transactional(readOnly = true)
    public StatsOverview overview(AuthenticatedUser user, Long venueId, LocalDate dateFrom, LocalDate dateTo) {
        List<Venue> scope = scopedVenues(user, venueId);
        LocalDateTime now = LocalDateTime.now(clock);
        StatsPeriod period = StatsPeriod.resolve(dateFrom, dateTo, now.toLocalDate());
        StatsFigures figures = calculator.compute(scope, period, now);
        List<VenueStats> byVenue = scope.stream()
                .map(venue -> new VenueStats(venue.getId(), venue.getName(), figures.reservationCount(venue.getId()),
                        figures.utilizationRate(venue.getId())))
                .toList();
        List<DailyStats> daily = period.dates().stream()
                .map(date -> new DailyStats(date, figures.reservationCountOn(date), figures.utilizationRateOn(date)))
                .toList();
        return new StatsOverview(period.from(), period.to(), figures.reservationCount(),
                figures.activeOccupiedSlots(), figures.openSlots(), figures.utilizationRate(), figures.currentInUse(),
                figures.userCancelCount(), figures.adminCancelCount(), figures.noShowRate(), byVenue, daily);
    }

    /**
     * O2：给了 venueId 先做授权检查（VA 越权 FORBIDDEN_SCOPE，含不存在的场馆），再取场馆（不存在 NOT_FOUND，只有 SA 会走到）；
     * 未给时 SA 为全部场馆、VA 为当前有效授权的场馆（可为空，空时不再查询）。均按 id 升序，含 CLOSED 场馆。
     */
    private List<Venue> scopedVenues(AuthenticatedUser user, Long venueId) {
        if (venueId != null) {
            venueScopeGuard.requireVenueAccess(user, venueId);
            return List.of(venueLookup.require(venueId));
        }
        if (user.role() == Role.SYS_ADMIN) {
            return venues.findAllByOrderByIdAsc();
        }
        List<Long> granted = venueScopeGuard.effectiveVenueIds(user.id());
        return granted.isEmpty() ? List.of() : venues.findAllByIdInOrderByIdAsc(granted);
    }
}
