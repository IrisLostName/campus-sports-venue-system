package com.campus.venue.venue.dto;

import com.campus.venue.availability.domain.SlotStatus;
import java.time.LocalTime;

/** 占用总览的时段（docs/12 第 5.5 节 OccupancySlot）：status 不含 MINE；无有效预约时 reservation 为 null。 */
public record OccupancySlot(LocalTime startTime, LocalTime endTime, SlotStatus status,
        OccupancyReservation reservation) {
}
