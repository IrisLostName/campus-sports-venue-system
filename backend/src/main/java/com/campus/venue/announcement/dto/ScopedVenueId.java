package com.campus.venue.announcement.dto;

/** 带 scope 与 venueId 的公告请求（GET /announcements 与 POST /admin/announcements），供 VenueIdMatchesScope 判定。 */
public interface ScopedVenueId {

    String scope();

    Long venueId();
}
