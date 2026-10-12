package com.campus.venue.venue.dto;

import java.time.LocalDate;
import java.util.List;

/** 场地占用总览（docs/12 第 5.5 节 Occupancy）。resourceCount = 非 DISABLED 的场地数。 */
public record Occupancy(long venueId, String venueName, LocalDate date, long resourceCount,
        List<OccupancyResource> resources) {
}
