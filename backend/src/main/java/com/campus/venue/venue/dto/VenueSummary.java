package com.campus.venue.venue.dto;

import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.domain.VenueType;

/** 场馆摘要（docs/12 第 4 节 VenueSummary）。bookable = 场馆 OPEN 且对用户开放；resourceCount = 非 DISABLED 的场地数。 */
public record VenueSummary(long id, String name, VenueType venueType, String location, String description,
        VenueStatus operationalStatus, boolean userBookingEnabled, boolean bookable, long resourceCount) {
}
