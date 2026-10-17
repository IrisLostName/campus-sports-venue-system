package com.campus.venue.user.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * GET /admin/users 的查询参数（docs/12 第 5.9 节，BE-6 U1）：均可缺省。keyword 同 BE-5（按原值 ≤ 50，空白视为未填）；
 * page、pageSize 同 GET /reservations/me。
 */
public record AdminUsersQuery(
        @Pattern(regexp = "USER|VENUE_ADMIN|SYS_ADMIN", message = "应为 USER/VENUE_ADMIN/SYS_ADMIN 之一")
        String role,

        @Size(max = 50, message = "不能超过 50 个字符")
        String keyword,

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
