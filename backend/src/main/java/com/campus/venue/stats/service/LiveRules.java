package com.campus.venue.stats.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalTime;

/**
 * 今天的预约在“现在”的判定（BE-7 K5、D4）。调用方只传入服务日期为今天的预约，所以只比较时刻；
 * 有效状态已由 DisplayStatusCalculator 算好（K7），这里不再判断判定点。
 */
final class LiveRules {

    private LiveRules() {
    }

    /**
     * K5“当前使用”与 D4 的 IN_USE（docs/03 第 8 节）：有效状态 CONFIRMED、有签到且无签退、开始 ≤ 现在 < 结束。
     * 与 mock inUseNow 一致；提前签到而尚未开始的不算（BE-7 裁决第 9 节第 3 条，API-SYNC 观察项）。
     */
    static boolean inUse(LiveReservation live, LocalTime now) {
        return live.effective() == ReservationStatus.CONFIRMED && live.usage() != null
                && live.usage().getCheckOutAt() == null && covers(live.reservation(), now);
    }

    /** 开始 ≤ now < 结束。 */
    static boolean covers(Reservation reservation, LocalTime now) {
        return !now.isBefore(reservation.getStartTime()) && now.isBefore(reservation.getEndTime());
    }
}
