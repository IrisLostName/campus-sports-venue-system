package com.campus.venue.reservation.dto;

/**
 * 同行人（docs/12 第 4 节 Companion，v1.2）：只有用户 id 与显示名。既是 Reservation.companions 的元素，
 * 也是 GET /users/lookup 的唯一返回体——不返回用户名、手机号等其他信息。
 */
public record Companion(long userId, String displayName) {
}
