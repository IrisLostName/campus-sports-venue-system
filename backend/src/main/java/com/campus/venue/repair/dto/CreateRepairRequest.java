package com.campus.venue.repair.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** 提交报修请求（docs/12 第 5.4 节，BE-6 R1）：venueId 必填正整数、resourceId 可选正整数、description 非空白 ≤ 500（原样保存）。 */
public record CreateRepairRequest(
        @NotNull(message = "必填")
        @Positive(message = "应为正整数")
        Long venueId,

        @Positive(message = "应为正整数")
        Long resourceId,

        @NotBlank(message = "必填")
        @Size(max = 500, message = "不能超过 500 个字符")
        String description) {
}
