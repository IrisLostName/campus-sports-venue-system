package com.campus.venue.announcement.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/**
 * GET /admin/announcements 的查询参数（docs/12 第 5.8 节，BE-6 N2）：均可缺省。只接受 page，pageSize 固定 20
 * （与 mock pagingChecks(page, undefined) 一致；多传的 pageSize 忽略，BE-6 C2）。
 */
public record AdminAnnouncementsQuery(
        @Pattern(regexp = "SYSTEM|VENUE", message = "应为 SYSTEM/VENUE 之一")
        String scope,

        @Positive(message = "应为正整数")
        Long venueId,

        @Pattern(regexp = "ACTIVE|ARCHIVED", message = "应为 ACTIVE/ARCHIVED 之一")
        String status,

        @Min(value = 1, message = "应为不小于 1 的整数")
        Integer page) {

    public int pageOrDefault() {
        return page == null ? 1 : page;
    }
}
