package com.campus.venue.reservation.dto;

/** 某个预约的签到码（docs/12 第 4 节 CheckInCode，契约 v1.1）：固定不变，对客户端不透明，≤ 100 字符。 */
public record CheckInCode(String code) {
}
