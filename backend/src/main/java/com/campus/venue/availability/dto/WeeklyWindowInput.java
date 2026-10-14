package com.campus.venue.availability.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * 周窗口替换请求中的一个窗口（docs/12 第 5.6 节）。时刻以字符串接收并按严格 HH:mm 校验，
 * 使全部窗口的字段问题能在一次响应中报告（BE-2a N1，与 mock ruleService.ts 的 windowChecks 一致）。
 */
public record WeeklyWindowInput(
        @NotNull(message = "必填")
        @Min(value = 1, message = "应为 1–7 的整数")
        @Max(value = 7, message = "应为 1–7 的整数")
        Integer weekday,

        @NotNull(message = "必填")
        @Pattern(regexp = "([01][0-9]|2[0-3]):[0-5][0-9]", message = "时刻格式应为 HH:mm")
        String openTime,

        @NotNull(message = "必填")
        @Pattern(regexp = "([01][0-9]|2[0-3]):[0-5][0-9]", message = "时刻格式应为 HH:mm")
        String closeTime) {
}
