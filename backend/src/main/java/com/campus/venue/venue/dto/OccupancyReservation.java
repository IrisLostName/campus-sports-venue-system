package com.campus.venue.venue.dto;

import com.campus.venue.reservation.domain.DisplayStatus;

/** 占用总览中时段上的有效预约（docs/12 第 5.5 节 OccupancySlot.reservation）。 */
public record OccupancyReservation(long id, String userDisplayName, DisplayStatus displayStatus) {
}
