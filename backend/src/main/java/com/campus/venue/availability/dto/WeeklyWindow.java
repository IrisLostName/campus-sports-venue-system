package com.campus.venue.availability.dto;

import java.time.LocalTime;

/** 每周开放窗口（docs/12 第 5.6 节 WeeklyWindow）。 */
public record WeeklyWindow(long id, int weekday, LocalTime openTime, LocalTime closeTime) {
}
