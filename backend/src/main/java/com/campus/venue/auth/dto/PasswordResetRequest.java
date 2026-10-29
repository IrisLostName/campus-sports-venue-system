package com.campus.venue.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 自助找回密码请求（docs/12 第 5.1 节 POST /auth/password-reset，契约 v1.3）。username 与登录相同（非空白、≤ 32）；
 * displayName 同注册（非空白、≤ 50）；phone 必填（缺失或空白 →“必填”），格式同注册；newPassword 规则同注册口令。
 */
public record PasswordResetRequest(
        @NotBlank(message = "必填")
        @Size(max = 32, message = "不能超过 32 个字符")
        String username,

        @AccountDisplayName
        String displayName,

        @NotBlank(message = "必填")
        @AccountPhone
        String phone,

        @AccountPassword
        String newPassword) {

    /** 不在日志或异常信息中输出手机号与新口令。 */
    @Override
    public String toString() {
        return "PasswordResetRequest[username=" + username + ", displayName=***, phone=***, newPassword=***]";
    }
}
