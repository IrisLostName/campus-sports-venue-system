package com.campus.venue.reservation.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/** 受影响预约的简要信息（docs/12 第 4 节 ReservationBrief）。 */
public record ReservationBrief(long id, String resourceName, LocalDate serviceDate, LocalTime startTime,
        LocalTime endTime, String userDisplayName) {
}
