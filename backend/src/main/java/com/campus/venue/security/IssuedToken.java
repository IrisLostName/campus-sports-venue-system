package com.campus.venue.security;

import java.time.LocalDateTime;

/** 签发结果：令牌串与 APP_TIMEZONE 下的过期时刻（与令牌 exp 是同一时刻，J3）。 */
public record IssuedToken(String token, LocalDateTime expiresAt) {
}
