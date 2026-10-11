package com.campus.venue.reservation.domain;

/** 预约状态（docs/12 第 2 节 ReservationStatus）。 */
public enum ReservationStatus {
    CONFIRMED,
    COMPLETED,
    CANCELLED,
    ADMIN_CANCELLED,
    NO_SHOW
}
