package com.campus.venue.auth.dto;

import com.campus.venue.common.validation.MaxUtf8Bytes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 注册请求（docs/12 第 5.1 节、BE-1 A1）。请求体中的 role、status 等其他字段一律忽略。
 * userType 以字符串接收，使非法值也能以 VALIDATION_ERROR 指明字段。
 */
public record RegisterRequest(
        @NotNull(message = "必填")
        @Pattern(regexp = "^[A-Za-z0-9_]{3,32}$", message = "须为 3–32 位字母、数字或下划线")
        String username,

        // BCrypt 只处理前 72 字节：超过即拒绝（BE-1 裁决第 11 节第 3 条）
        @NotNull(message = "必填")
        @Size(min = 8, max = 64, message = "长度须为 8–64 位")
        @MaxUtf8Bytes(value = 72, message = "不能超过 72 字节")
        String password,

        @NotBlank(message = "必填")
        @Size(max = 50, message = "不能超过 50 个字符")
        String displayName,

        @Pattern(regexp = "STUDENT|TEACHER|OTHER", message = "须为 STUDENT、TEACHER 或 OTHER")
        String userType,

        // 空白视为未填；非空白时不超过 20 个字符，不校验格式
        @Pattern(regexp = "(?s)\\s*|.{0,20}", message = "不能超过 20 个字符")
        String phone) {
}
