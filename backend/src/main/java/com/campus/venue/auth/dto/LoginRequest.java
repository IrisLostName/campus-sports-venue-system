package com.campus.venue.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 登录请求（docs/12 第 5.1 节）。校验与前端 mock 一致（BE-1 裁决第 11 节更正）：均非空白，用户名 ≤ 32、口令 ≤ 64。 */
public record LoginRequest(
        @NotBlank(message = "必填")
        @Size(max = 32, message = "不能超过 32 个字符")
        String username,

        @NotBlank(message = "必填")
        @Size(max = 64, message = "不能超过 64 个字符")
        String password) {
}
