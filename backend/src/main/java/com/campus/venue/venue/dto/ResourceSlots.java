package com.campus.venue.venue.dto;

import com.campus.venue.venue.domain.ResourceStatus;
import java.util.List;

/** 某场地当天的时段（docs/12 第 4 节 ResourceSlots）。 */
public record ResourceSlots(long resourceId, String resourceName, ResourceStatus operationalStatus,
        List<SlotItem> slots) {
}
