package com.campus.venue.audit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * GET /admin/logs 的查询参数（docs/12 第 5.10 节，BE-6 L1）：均可缺省。venueId 正整数；action 为 LogAction 15 值之一；
 * 日期严格 yyyy-MM-dd；page、pageSize 同 GET /reservations/me。类型不符的参数报“类型不符”。
 */
public record LogsQuery(
        @Positive(message = "应为正整数")
        Long venueId,

        @Pattern(regexp = "RESERVATION_CANCEL|RESERVATION_REASSIGN_RESOURCE|RESERVATION_REASSIGN_USER"
                + "|RESOURCE_STATUS_CHANGE|RESOURCE_COUNT_CHANGE|VENUE_UPDATE|RULE_WEEKLY_UPDATE|CLOSURE_ADD"
                + "|CLOSURE_REMOVE|SCOPE_UPDATE|USER_CREATE|USER_STATUS_CHANGE|ANNOUNCEMENT_PUBLISH"
                + "|ANNOUNCEMENT_ARCHIVE|REPAIR_UPDATE",
                message = "应为 RESERVATION_CANCEL/RESERVATION_REASSIGN_RESOURCE/RESERVATION_REASSIGN_USER"
                        + "/RESOURCE_STATUS_CHANGE/RESOURCE_COUNT_CHANGE/VENUE_UPDATE/RULE_WEEKLY_UPDATE/CLOSURE_ADD"
                        + "/CLOSURE_REMOVE/SCOPE_UPDATE/USER_CREATE/USER_STATUS_CHANGE/ANNOUNCEMENT_PUBLISH"
                        + "/ANNOUNCEMENT_ARCHIVE/REPAIR_UPDATE 之一")
        String action,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateFrom,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateTo,

        @Min(value = 1, message = "应为不小于 1 的整数")
        Integer page,

        @Min(value = 1, message = "应为 1–100 的整数")
        @Max(value = 100, message = "应为 1–100 的整数")
        Integer pageSize) {

    private static final int DEFAULT_PAGE_SIZE = 20;

    public int pageOrDefault() {
        return page == null ? 1 : page;
    }

    public int pageSizeOrDefault() {
        return pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
    }
}
