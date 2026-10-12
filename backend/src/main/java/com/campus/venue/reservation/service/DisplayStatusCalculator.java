package com.campus.venue.reservation.service;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.reservation.domain.DisplayStatus;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

/**
 * 展示状态计算（BE-2a P1，docs/03 第 4.4 节）：纯计算，不查库；签到窗口参数取 BookingProperties。
 * 签到窗口为闭区间 [开始 − checkinOpenBefore, 开始 + checkinCloseAfter]（FE-1 裁决 A5）。
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
        if (reservation.getStatus() != ReservationStatus.CONFIRMED) {
            return DisplayStatus.valueOf(reservation.getStatus().name());
        }
        LocalDateTime start = LocalDateTime.of(reservation.getServiceDate(), reservation.getStartTime());
        if (usage == null) {
            if (now.isAfter(start.plusMinutes(properties.checkinCloseAfterMinutes()))) {
                return DisplayStatus.NO_SHOW;
            }
            return now.isBefore(start.minusMinutes(properties.checkinOpenBeforeMinutes()))
                    ? DisplayStatus.UPCOMING
                    : DisplayStatus.CHECKIN_OPEN;
        }
        LocalDateTime end = LocalDateTime.of(reservation.getServiceDate(), reservation.getEndTime());
        if (!now.isBefore(end)) {
            return DisplayStatus.COMPLETED;
        }
        return usage.getCheckOutAt() == null ? DisplayStatus.IN_USE : DisplayStatus.CHECKED_OUT;
    }
}
