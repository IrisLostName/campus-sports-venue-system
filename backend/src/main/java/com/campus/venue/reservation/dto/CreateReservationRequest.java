package com.campus.venue.reservation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * 创建预约请求（docs/12 第 5.3 节，BE-3 C1）。日期、时刻由全局 JSON 配置严格解析（yyyy-MM-dd、HH:mm），
 * 格式错误以 VALIDATION_ERROR 指明字段；purpose 可选、≤ 200，空白视为未填。
 * 请求中的 userId、endTime、status 等其他字段一律忽略（用户取自令牌，结束时刻由服务端算出）。
 */
public record CreateReservationRequest(
        @NotNull(message = "必填")
        @Positive(message = "应为正整数")
        Long resourceId,

        @NotNull(message = "必填")
        LocalDate serviceDate,

        @NotNull(message = "必填")
        LocalTime startTime,

        @Pattern(regexp = "(?s)\\s*|.{0,200}", message = "不能超过 200 个字符")
        String purpose) {
}
