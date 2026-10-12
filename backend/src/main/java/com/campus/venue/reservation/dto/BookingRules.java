package com.campus.venue.reservation.dto;

/** 预约参数（docs/12 第 4 节 BookingRules），字段名逐字一致。 */
public record BookingRules(
        int slotMinutes,
        int advanceDays,
        int cancelDeadlineMinutes,
        int checkInOpenBeforeMinutes,
        int checkInCloseAfterMinutes,
        int checkOutGraceMinutes,
        int maxActiveReservationsPerUser,
        String timezone) {
}
