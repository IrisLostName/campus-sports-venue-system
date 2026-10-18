package com.campus.venue.stats.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;

/**
 * 今天的一个有效预约及其使用记录（可空）与有效状态（DisplayStatusCalculator.effectiveStatus，BE-7 K7）。
 * 只用于 K5 与大屏实时状态 D4。
 */
record LiveReservation(Reservation reservation, UsageRecord usage, ReservationStatus effective) {
}
