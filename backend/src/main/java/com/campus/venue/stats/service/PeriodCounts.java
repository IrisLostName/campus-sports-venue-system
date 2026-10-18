package com.campus.venue.stats.service;

import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;

/**
 * 区间内的计数（BE-7 第 2 节）：按“场馆 × 日期”的 K1（创建日期）、K2（服务日期）、K3（开放时段），
 * 以及区间合计的两类取消量与 K6 的 NO_SHOW、COMPLETED（库中状态 + 越过判定点的候选，K7）。由 StatsCalculator 填写。
 */
final class PeriodCounts {

    private final VenueDayCounts created = new VenueDayCounts();
    private final VenueDayCounts occupied = new VenueDayCounts();
    private final VenueDayCounts open = new VenueDayCounts();
    private long userCancelled;
    private long adminCancelled;
    private long noShow;
    private long completed;

    /** K1：按创建日期归入，含已取消；CANCELLED、ADMIN_CANCELLED 另计为用户取消量、管理员取消量。 */
    void created(long venueId, LocalDate date, ReservationStatus status, long count) {
        created.add(venueId, date, count);
        if (status == ReservationStatus.CANCELLED) {
            userCancelled += count;
        } else if (status == ReservationStatus.ADMIN_CANCELLED) {
            adminCancelled += count;
        }
    }

    /** K2：按服务日期归入，排除两类取消（与场地当前状态无关）；库中 NO_SHOW、COMPLETED 计入 K6。 */
    void served(long venueId, LocalDate date, ReservationStatus status, long count) {
        if (!StatsDataReader.CANCELLED.contains(status)) {
            occupied.add(venueId, date, count);
        }
        if (status == ReservationStatus.NO_SHOW) {
            noShow += count;
        } else if (status == ReservationStatus.COMPLETED) {
            completed += count;
        }
    }

    /** K3：该场馆当天的开放时段数。 */
    void open(long venueId, LocalDate date, long slots) {
        open.add(venueId, date, slots);
    }

    /** K7：库中仍为 CONFIRMED、有效状态已是 NO_SHOW / COMPLETED 的预约数（清扫尚未落库）。 */
    void overdue(long overdueNoShow, long overdueCompleted) {
        noShow += overdueNoShow;
        completed += overdueCompleted;
    }

    VenueDayCounts created() {
        return created;
    }

    VenueDayCounts occupied() {
        return occupied;
    }

    VenueDayCounts open() {
        return open;
    }

    long userCancelled() {
        return userCancelled;
    }

    long adminCancelled() {
        return adminCancelled;
    }

    long noShow() {
        return noShow;
    }

    long completed() {
        return completed;
    }
}
