package com.campus.venue.stats.dto;

import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * GET /admin/stats/overview 的查询参数（docs/12 第 5.10 节，BE-7 O1）：均可缺省。venueId 正整数；日期严格 yyyy-MM-dd，
 * 类型不符的参数报“类型不符”。分组顺序：格式 → 补缺省区间后的天数检查（StatsDateRange），二者都在角色检查之前；
 * 任一格式错误时不做天数检查（与 mock validateStatsFormat → validateStatsRange 一致）。
 */
@GroupSequence({StatsOverviewQuery.class, StatsRangeCheck.class})
@StatsDateRange(groups = StatsRangeCheck.class)
public record StatsOverviewQuery(
        @Positive(message = "应为正整数")
        Long venueId,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateFrom,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateTo) {
}
