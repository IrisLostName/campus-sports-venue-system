package com.campus.venue.repair.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/**
 * GET /admin/repairs 的查询参数（docs/12 第 5.4 节，BE-6 R3）：均可缺省。只接受 page，pageSize 固定 20
 * （与 mock pagingChecks(page, undefined) 一致；多传的 pageSize 忽略，BE-6 C2）。
 */
public record AdminRepairsQuery(
        @Positive(message = "应为正整数")
        Long venueId,

        @Pattern(regexp = "SUBMITTED|IN_PROGRESS|RESOLVED", message = "应为 SUBMITTED/IN_PROGRESS/RESOLVED 之一")
        String status,

        @Min(value = 1, message = "应为不小于 1 的整数")
        Integer page) {

    public int pageOrDefault() {
        return page == null ? 1 : page;
    }
}
