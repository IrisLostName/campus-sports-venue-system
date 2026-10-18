package com.campus.venue.stats.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.stats.dto.StatsOverview;
import com.campus.venue.stats.dto.StatsOverviewQuery;
import com.campus.venue.stats.service.StatsOverviewService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端统计总览（docs/12 第 5.10 节，BE-7 O1）：VA、SA。查询参数的格式与区间天数检查先于角色检查（方法级注解），
 * 场馆范围在服务层。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/stats")
public class AdminStatsController {

    private final StatsOverviewService overviewService;

    public AdminStatsController(StatsOverviewService overviewService) {
        this.overviewService = overviewService;
    }

    /** 返回 StatsOverview；VA 不带 venueId 时聚合其授权场馆。 */
    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public StatsOverview overview(@AuthenticationPrincipal AuthenticatedUser user, @Valid StatsOverviewQuery query) {
        return overviewService.overview(user, query.venueId(), query.dateFrom(), query.dateTo());
    }
}
