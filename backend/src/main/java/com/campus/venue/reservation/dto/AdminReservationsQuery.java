package com.campus.venue.reservation.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

/**
 * 管理端预约列表的查询参数（docs/12 第 5.7 节，BE-5 A1），由查询字符串绑定；均可缺省。
 * 格式：venueId 正整数；日期严格 yyyy-MM-dd；status 为 ReservationStatus 五值之一（文案同 mock oneOfProblem）；
 * keyword 按原值 ≤ 50（空白视为未填）；page、pageSize 同 GET /reservations/me。类型不符的参数报“类型不符”。
 */
public record AdminReservationsQuery(
        @Positive(message = "应为正整数")
        Long venueId,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateFrom,

        @DateTimeFormat(pattern = "yyyy-MM-dd")
        LocalDate dateTo,

        @Pattern(regexp = "CONFIRMED|COMPLETED|CANCELLED|ADMIN_CANCELLED|NO_SHOW",
                message = "应为 CONFIRMED/COMPLETED/CANCELLED/ADMIN_CANCELLED/NO_SHOW 之一")
        String status,

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
