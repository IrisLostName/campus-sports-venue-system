package com.campus.venue.stats.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 统计区间 [from, to]，两端含（BE-7 O1）。缺省区间与 mock statsService.ts 一致（FE-1 A14）：dateTo 缺省为今天，
 * dateFrom 缺省为 dateTo − 6；天数须在 1–366 之间。区间检查（StatsDateRange）与统计服务共用这里的缺省与天数计算。
 */
public record StatsPeriod(LocalDate from, LocalDate to) {

    /** 区间天数上限（mock MAX_RANGE_DAYS，API-SYNC 观察项）。 */
    public static final int MAX_DAYS = 366;

    /** 缺省区间与大屏 weekTrend 都是含今天的 7 天（mock TREND_DAYS）。 */
    public static final int RECENT_DAYS = 7;

    /** 补缺省区间；不检查天数（见 withinLimit）。 */
    public static StatsPeriod resolve(LocalDate dateFrom, LocalDate dateTo, LocalDate today) {
        LocalDate to = dateTo == null ? today : dateTo;
        LocalDate from = dateFrom == null ? to.minusDays(RECENT_DAYS - 1) : dateFrom;
        return new StatsPeriod(from, to);
    }

    /** 含 today 的近 7 天（大屏）。 */
    public static StatsPeriod recent(LocalDate today) {
        return new StatsPeriod(today.minusDays(RECENT_DAYS - 1), today);
    }

    /** dateTo − dateFrom + 1；dateFrom 晚于 dateTo 时不大于 0。 */
    public long days() {
        return ChronoUnit.DAYS.between(from, to) + 1;
    }

    public boolean withinLimit() {
        long days = days();
        return days >= 1 && days <= MAX_DAYS;
    }

    /** 区间内每一天，升序。只用于已通过 withinLimit 的区间。 */
    public List<LocalDate> dates() {
        return from.datesUntil(to.plusDays(1)).toList();
    }
}
