package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 用户当前持有的预约（BE-3 E1、E2）：有效状态为 CONFIRMED 且结束时刻晚于现在，按服务日期、开始时间、id 升序。
 * 创建第 7 步的持有数与我的预约 CURRENT 共用这一处定义（mock 的 stepUnderLimit、isCurrent 在 sweep 之后判断，结果相同）。
 * 库中只按“CONFIRMED 且未结束”取候选；越过判定点（未签到且已过签到窗口）的由 DisplayStatusCalculator 排除。
 * 候选集很小：第 7 步与 C4 把用户持有数限制在 maxActiveReservationsPerUser 内，此外只有已开始未结束、尚未清扫的少数几条。
 */
@Component
public class HeldReservations {

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;

    public HeldReservations(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
    }

    public List<Reservation> of(long userId, LocalDateTime now) {
        List<Reservation> unfinished = reservations.findUnfinished(userId, ReservationStatus.CONFIRMED,
                now.toLocalDate(), now.toLocalTime());
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(
                unfinished.stream().map(Reservation::getId).toList());
        return unfinished.stream()
                .filter(reservation -> calculator.effectiveStatus(reservation, usage.get(reservation.getId()), now)
                        == ReservationStatus.CONFIRMED)
                .toList();
    }
}
