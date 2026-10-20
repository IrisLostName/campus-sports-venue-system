package com.campus.venue.reservation.domain;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

/** 预约状态（docs/12 第 2 节 ReservationStatus）。 */
public enum ReservationStatus {
    CONFIRMED,
    COMPLETED,
    CANCELLED,
    ADMIN_CANCELLED,
    NO_SHOW;

    /**
     * 不占用时段的两类取消（docs/03 第 4.1 节，与部分唯一索引 uq_reservation_active_slot 的条件一致）。
     * 创建预约与改派的占用检查、时段派生、统计共用这一处定义（TEST-1 K5，BE-7 N6）。
     */
    public static final Set<ReservationStatus> NOT_OCCUPYING =
            Collections.unmodifiableSet(EnumSet.of(CANCELLED, ADMIN_CANCELLED));
}
