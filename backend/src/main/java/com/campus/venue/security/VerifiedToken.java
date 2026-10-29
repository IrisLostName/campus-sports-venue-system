package com.campus.venue.security;

import java.time.Instant;

/** 校验通过的令牌：用户 id 与签发时刻 iat（签发时已截到整秒）。 */
public record VerifiedToken(long userId, Instant issuedAt) {
}
