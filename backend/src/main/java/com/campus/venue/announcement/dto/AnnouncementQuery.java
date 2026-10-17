package com.campus.venue.announcement.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * GET /announcements 的查询参数（docs/12 第 5.2 节，BE-6 N1）：scope 必填；scope=VENUE 时 venueId 必填正整数，
 * scope=SYSTEM 时 venueId 可给（须为正整数）但不参与过滤（与 mock 一致）。
 */
@VenueIdMatchesScope(systemAllowsVenueId = true)
public record AnnouncementQuery(
        @NotNull(message = "必填")
        @Pattern(regexp = "SYSTEM|VENUE", message = "应为 SYSTEM/VENUE 之一")
        String scope,

        Long venueId) implements ScopedVenueId {
}
