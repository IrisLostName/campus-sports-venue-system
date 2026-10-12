package com.campus.venue.venue.dto;

import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.ResourceType;

/** 场地（docs/12 第 4 节 Resource；类名避免与实体同名）。 */
public record ResourceView(long id, long venueId, String name, ResourceType resourceType, int sortOrder,
        ResourceStatus operationalStatus) {
}
