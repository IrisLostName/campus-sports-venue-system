package com.campus.venue.stats.service;

import com.campus.venue.availability.service.OpeningCalendar;
import com.campus.venue.venue.domain.Resource;
import java.time.LocalDate;
import java.util.List;

/**
 * StatsCalculator 一次计算的结果（BE-7 第 2 节）：管理端总览与大屏都从这里取数，只做组装。
 * 比率为 null 表示分母为 0（K4、K6）；不四舍五入、不截断（K8，利用率可能大于 1）。
 */
public final class StatsFigures {

    private final PeriodCounts counts;
    private final TodayFacts today;

    StatsFigures(PeriodCounts counts, TodayFacts today) {
        this.counts = counts;
        this.today = today;
    }

    /** K4、K6 的比率：分母为 0 时 null（不是 0、不是 NaN），否则直接相除。 */
    static Double rate(long numerator, long denominator) {
        return denominator == 0 ? null : (double) numerator / denominator;
    }

    /** K1：区间内创建的预约数，含已取消。 */
    public long reservationCount() {
        return counts.created().total();
    }

    public long reservationCount(long venueId) {
        return counts.created().ofVenue(venueId);
    }

    public long reservationCountOn(LocalDate date) {
        return counts.created().onDay(date);
    }

    /** K1 的预约中状态为 CANCELLED 的数量。 */
    public long userCancelCount() {
        return counts.userCancelled();
    }

    /** K1 的预约中状态为 ADMIN_CANCELLED 的数量。 */
    public long adminCancelCount() {
        return counts.adminCancelled();
    }

    /** K2：服务日期在区间内的有效占用时段数。 */
    public long activeOccupiedSlots() {
        return counts.occupied().total();
    }

    /** K3：区间内的开放时段数。 */
    public long openSlots() {
        return counts.open().total();
    }

    /** K4：K2 ÷ K3。 */
    public Double utilizationRate() {
        return rate(counts.occupied().total(), counts.open().total());
    }

    /** K4：该场馆区间内 K2 ÷ K3。 */
    public Double utilizationRate(long venueId) {
        return rate(counts.occupied().ofVenue(venueId), counts.open().ofVenue(venueId));
    }

    /** K4：当天（全部范围内场馆）K2 ÷ K3。 */
    public Double utilizationRateOn(LocalDate date) {
        return rate(counts.occupied().onDay(date), counts.open().onDay(date));
    }

    /** K6：NO_SHOW ÷（NO_SHOW + COMPLETED），按有效状态（K7）。 */
    public Double noShowRate() {
        return rate(counts.noShow(), counts.noShow() + counts.completed());
    }

    /** K5：现在的使用中预约数，与区间无关。 */
    public long currentInUse() {
        return today.inUse();
    }

    /** 范围内全部场地（含 DISABLED），按场馆 id、sortOrder、id 升序。 */
    List<Resource> resources() {
        return today.resources();
    }

    /** 区间的开放日历（大屏的区间含今天）。 */
    OpeningCalendar calendar() {
        return today.calendar();
    }

    /** 该场地今天的有效预约（D4）。 */
    List<LiveReservation> todayOn(long resourceId) {
        return today.byResource().getOrDefault(resourceId, List.of());
    }
}
