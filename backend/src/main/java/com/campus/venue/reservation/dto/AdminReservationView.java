package com.campus.venue.reservation.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/**
 * 管理端预约（docs/12 第 5.7 节 AdminReservation = Reservation &amp; {userUsername, userPhone}）。
 * Reservation 的字段平铺在同一层（不嵌套）；userPhone 可空，为空时返回 null（BE-5 裁决 P2）。
 */
public record AdminReservationView(
        @JsonUnwrapped
        ReservationView reservation,
        String userUsername,
        String userPhone) {
}
