package com.campus.venue.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 修改账号请求（docs/12 第 5.9 节，BE-6 U3）：任意子集；字段为 null 或缺省即“不修改”。displayName 给了须非空白、≤ 50；
 * status 为 ACTIVE 或 DISABLED。不能改角色、用户名、口令（请求体中的其他字段忽略）。
 */
public record UpdateUserRequest(
        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 50, message = "不能超过 50 个字符")
        String displayName,

        @Pattern(regexp = "ACTIVE|DISABLED", message = "应为 ACTIVE/DISABLED 之一")
        String status) {
}
