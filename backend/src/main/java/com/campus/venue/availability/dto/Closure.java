package com.campus.venue.availability.dto;

import java.time.LocalDate;

/** 特殊关闭（docs/12 第 5.6 节 Closure）。resourceId 为 null 表示整馆关闭。 */
public record Closure(long id, long venueId, Long resourceId, LocalDate startDate, LocalDate endDate,
        String reason) {
}
