package com.campus.venue.reservation.service;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.reservation.domain.DisplayStatus;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

/**
 * 展示状态与有效状态计算（BE-2a P1、BE-3 E1，docs/03 第 4.3、4.4 节）：纯计算，不查库；签到窗口参数取 BookingProperties。
 * 签到窗口为闭区间 [开始 − checkinOpenBefore, 开始 + checkinCloseAfter]（FE-1 裁决 A5）。
 * 越过判定点的两个判定（noShowDue、completionDue）只在这里实现：展示状态、有效状态与 BE-4 的清扫落库共用。
 * mock 的 displayStatusOf 依赖 sweep 先落库 NO_SHOW/COMPLETED，这里直接按时间点即时计算，结果相同。
 */
@Component
public class DisplayStatusCalculator {

    private final BookingProperties properties;

    public DisplayStatusCalculator(BookingProperties properties) {
        this.properties = properties;
    }

    /** usage 为该预约的使用记录，没有时传 null；now 为业务时区的当前本地时间。 */
    public DisplayStatus of(Reservation reservation, UsageRecord usage, LocalDateTime now) {
        ReservationStatus effective = effectiveStatus(reservation, usage, now);
        if (effective != ReservationStatus.CONFIRMED) {
            return DisplayStatus.valueOf(effective.name());
        }
        if (usage == null) {
            LocalDateTime start = LocalDateTime.of(reservation.getServiceDate(), reservation.getStartTime());
            return now.isBefore(start.minusMinutes(properties.checkinOpenBeforeMinutes()))
                    ? DisplayStatus.UPCOMING
                    : DisplayStatus.CHECKIN_OPEN;
        }
        return usage.getCheckOutAt() == null ? DisplayStatus.IN_USE : DisplayStatus.CHECKED_OUT;
    }

    /**
     * 有效状态（BE-3 E1）：库中为 CONFIRMED 但已越过判定点而清扫尚未落库的，按 NO_SHOW / COMPLETED 计；否则为库中状态。
     * 用于响应的 status、我的预约 CURRENT/HISTORY 划分、创建第 7 步持有数、取消的 INVALID_STATE 判断。
     */
    public ReservationStatus effectiveStatus(Reservation reservation, UsageRecord usage, LocalDateTime now) {
        if (noShowDue(reservation, usage, now)) {
            return ReservationStatus.NO_SHOW;
        }
        if (completionDue(reservation, usage, now)) {
            return ReservationStatus.COMPLETED;
        }
        return reservation.getStatus();
    }

    /** 置 NO_SHOW 的判定点（docs/03 第 4.3 节）：CONFIRMED、无签到记录、现在晚于 开始 + checkinCloseAfter。 */
    public boolean noShowDue(Reservation reservation, UsageRecord usage, LocalDateTime now) {
        LocalDateTime start = LocalDateTime.of(reservation.getServiceDate(), reservation.getStartTime());
        return reservation.getStatus() == ReservationStatus.CONFIRMED && usage == null
                && now.isAfter(start.plusMinutes(properties.checkinCloseAfterMinutes()));
    }

    /** 置 COMPLETED 的判定点（docs/03 第 4.3 节）：CONFIRMED、有签到记录、现在不早于结束时刻。 */
    public boolean completionDue(Reservation reservation, UsageRecord usage, LocalDateTime now) {
        LocalDateTime end = LocalDateTime.of(reservation.getServiceDate(), reservation.getEndTime());
        return reservation.getStatus() == ReservationStatus.CONFIRMED && usage != null && !now.isBefore(end);
    }
}
