package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.AdminReservationFilter;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 有效状态的“候选集”分类（BE-5 第 8 节第 3 条；BE-7 K7 复用）：从 AdminReservationQueryService 原样移出。
 * 越过判定点的判定只在 DisplayStatusCalculator 一处实现，所以不在 SQL 里复写“开始 + checkInCloseAfter”“结束时刻”
 * 这些判定点：库中状态与有效状态只可能在“库中 CONFIRMED 且已开始”的记录上不同，先在给定的场馆与日期范围内取出这些候选，
 * 用 DisplayStatusCalculator 判定后得到将计为 NO_SHOW / COMPLETED 的 id。清扫每分钟落库，正常运行时候选集很小。
 * 事务由调用方提供。
 */
@Component
public class OverdueReservations {

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;

    public OverdueReservations(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
    }

    /** 库中 CONFIRMED、但有效状态已是 NO_SHOW / COMPLETED（清扫尚未落库）的预约 id。 */
    public record Overdue(List<Long> noShow, List<Long> completed) {
    }

    /** scope 只用其场馆与日期范围（scopeOnly）；两条语句：候选与其使用记录（候选为空时不查使用记录）。 */
    public Overdue find(AdminReservationFilter scope, LocalDateTime now) {
        List<Reservation> started = reservations.findStartedConfirmedForAdmin(scope, now.toLocalDate(),
                now.toLocalTime());
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(
                started.stream().map(Reservation::getId).toList());
        Overdue overdue = new Overdue(new ArrayList<>(), new ArrayList<>());
        for (Reservation reservation : started) {
            ReservationStatus effective = calculator.effectiveStatus(reservation, usage.get(reservation.getId()), now);
            if (effective == ReservationStatus.NO_SHOW) {
                overdue.noShow().add(reservation.getId());
            } else if (effective == ReservationStatus.COMPLETED) {
                overdue.completed().add(reservation.getId());
            }
        }
        return overdue;
    }
}
