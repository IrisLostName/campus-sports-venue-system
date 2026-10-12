package com.campus.venue.venue.dto;

import com.campus.venue.availability.domain.SlotStatus;
import java.time.LocalTime;

/** 用户端时段（docs/12 第 4 节 SlotItem）。 */
public record SlotItem(LocalTime startTime, LocalTime endTime, SlotStatus status) {
}
