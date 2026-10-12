package com.campus.venue.venue.dto;

import java.time.LocalDate;
import java.util.List;

/** 用户端某场馆某日的时段（docs/12 第 4 节 VenueSlots）。 */
public record VenueSlots(long venueId, String venueName, LocalDate date, List<ResourceSlots> resources) {
}
