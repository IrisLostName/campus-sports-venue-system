package com.campus.venue.stats.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * 统计总览（docs/12 第 5.10 节 StatsOverview，BE-7 O3）。比率为 null 表示分母为 0，JSON 中键仍然存在。
 *
 * @param dateFrom 实际使用的区间起点
 * @param dateTo 实际使用的区间终点
 * @param byVenue 范围内每个场馆一项，按场馆 id 升序
 * @param daily 区间内每天一项，升序
 */
public record StatsOverview(
        LocalDate dateFrom,
        LocalDate dateTo,
        long reservationCount,
        long activeOccupiedSlots,
        long openSlots,
        Double utilizationRate,
        long currentInUse,
        long userCancelCount,
        long adminCancelCount,
        Double noShowRate,
        List<VenueStats> byVenue,
        List<DailyStats> daily) {

    /** 某场馆区间内的预约量（K1）与利用率（K2 ÷ K3）。 */
    public record VenueStats(long venueId, String venueName, long reservationCount, Double utilizationRate) {
    }

    /** 某天的预约量（K1）与利用率（K2 ÷ K3）。 */
    public record DailyStats(LocalDate date, long reservationCount, Double utilizationRate) {
    }
}
