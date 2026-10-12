package com.campus.venue.venue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 新建场馆请求（docs/12 第 5.5 节、BE-2a A4）。其他字段一律忽略。
 * venueType 以字符串接收，使非法值也能以 VALIDATION_ERROR 指明字段；location、description 空白视为未填。
 */
public record CreateVenueRequest(
        @NotBlank(message = "必填")
        @Size(max = 50, message = "不能超过 50 个字符")
        String name,

        @NotNull(message = "必填")
        @Pattern(regexp = "TENNIS|BADMINTON|SWIMMING|BASKETBALL|OTHER",
                message = "须为 TENNIS、BADMINTON、SWIMMING、BASKETBALL 或 OTHER")
        String venueType,

        @Pattern(regexp = "(?s)\\s*|.{0,100}", message = "不能超过 100 个字符")
        String location,

        @Pattern(regexp = "(?s)\\s*|.{0,500}", message = "不能超过 500 个字符")
        String description) {
}
