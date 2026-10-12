package com.campus.venue.availability.domain;

import java.time.LocalTime;

/** 待校验的每周开放窗口（BE-2a R1）：weekday 1（周一）–7（周日），[openTime, closeTime)。 */
public record WindowSpec(int weekday, LocalTime openTime, LocalTime closeTime) {
}
