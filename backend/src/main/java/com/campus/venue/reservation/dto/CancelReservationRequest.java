package com.campus.venue.reservation.dto;

import jakarta.validation.constraints.Pattern;

/** 用户取消预约请求（docs/12 第 5.3 节，BE-3 X1）：reason 可选、≤ 200，空白视为未填；请求体可缺省。 */
public record CancelReservationRequest(
        @Pattern(regexp = "(?s)\\s*|.{0,200}", message = "不能超过 200 个字符")
        String reason) {
}
