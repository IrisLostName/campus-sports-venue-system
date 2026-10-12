package com.campus.venue.availability.domain;

/** 时段派生状态（docs/12 第 2 节、docs/03 第 3.1 节），接口返回，不落库。 */
public enum SlotStatus {
    AVAILABLE,
    BOOKED,
    MINE,
    CLOSED,
    PAST
}
