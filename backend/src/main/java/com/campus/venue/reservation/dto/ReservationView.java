package com.campus.venue.reservation.dto;

import com.campus.venue.reservation.domain.DisplayStatus;
import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 预约（docs/12 第 4 节 Reservation）。status 为有效状态（BE-3 E2）：越过判定点而清扫尚未落库的 CONFIRMED
 * 已按 NO_SHOW / COMPLETED 返回；checkInAt、checkOutAt 取自 usage_record。可空字段返回 null。
 */
public record ReservationView(
        long id,
        long venueId,
        String venueName,
        long resourceId,
        String resourceName,
        long userId,
        String userDisplayName,
        LocalDate serviceDate,
        LocalTime startTime,
        LocalTime endTime,
        ReservationStatus status,
        DisplayStatus displayStatus,
        String purpose,
        LocalDateTime createdAt,
        LocalDateTime cancelledAt,
        String cancelReason,
        Long cancelledBy,
        String adminNote,
        LocalDateTime checkInAt,
        LocalDateTime checkOutAt) {
}
