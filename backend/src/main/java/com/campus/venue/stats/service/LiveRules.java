package com.campus.venue.stats.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalTime;
import java.util.Optional;

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

    /**
     * D4 的 RESERVED（docs/03 第 4.5 节，FE-1 F2）：有效状态 CONFIRMED、未签到，且其区间包含现在，或其开始时刻等于
     * “当前时段”的结束时刻。只比较开始时刻，不核对它是否仍是派生时段（与 mock 一致，FE-1 R-N1）；
     * 现在不在任何派生时段内时没有当前时段（currentSlotEnd 为空），也就没有下一时段。
     */
    static boolean reserved(LiveReservation live, LocalTime now, Optional<LocalTime> currentSlotEnd) {
        LocalTime start = live.reservation().getStartTime();
        return live.effective() == ReservationStatus.CONFIRMED && live.usage() == null
                && (covers(live.reservation(), now) || currentSlotEnd.map(start::equals).orElse(false));
    }

    /** 开始 ≤ now < 结束。 */
    static boolean covers(Reservation reservation, LocalTime now) {
        return !now.isBefore(reservation.getStartTime()) && now.isBefore(reservation.getEndTime());
    }
}
