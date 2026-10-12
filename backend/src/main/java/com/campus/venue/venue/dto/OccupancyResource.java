package com.campus.venue.venue.dto;

import com.campus.venue.venue.domain.ResourceStatus;
import java.util.List;

/** 占用总览中的一个场地（docs/12 第 5.5 节 Occupancy.resources 的元素）。 */
public record OccupancyResource(long resourceId, String resourceName, ResourceStatus operationalStatus,
        List<OccupancySlot> slots) {
}
