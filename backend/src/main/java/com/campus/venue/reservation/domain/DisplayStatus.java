package com.campus.venue.reservation.domain;

/** 预约展示状态（docs/12 第 2 节、docs/03 第 4.4 节），由后端即时计算，不落库。 */
public enum DisplayStatus {
    UPCOMING,
    CHECKIN_OPEN,
    IN_USE,
    CHECKED_OUT,
    COMPLETED,
    CANCELLED,
    ADMIN_CANCELLED,
    NO_SHOW
}
