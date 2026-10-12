package com.campus.venue.auth.dto;

import java.time.LocalDateTime;

/** 登录或注册成功的响应（docs/12 第 5.1 节）：expiresAt 为 APP_TIMEZONE 下的本地时间，与令牌 exp 同一时刻。 */
public record LoginResponse(String token, LocalDateTime expiresAt, UserProfile user) {
}
