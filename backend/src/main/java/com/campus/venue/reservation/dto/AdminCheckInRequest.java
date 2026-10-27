package com.campus.venue.reservation.dto;

import com.campus.venue.reservation.service.CheckInCodes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 扫码签到请求（docs/12 第 5.7 节 POST /admin/check-ins，契约 v1.1）：code 为非空白字符串、≤ 100，且符合签到码格式
 * （CheckInCodes），否则 VALIDATION_ERROR（fields.code）。不去除首尾空白。
 */
public record AdminCheckInRequest(
        @NotBlank(message = "必填")
        @Size(max = 100, message = "不能超过 100 个字符")
        @Pattern(regexp = CheckInCodes.REGEXP, message = "签到码格式不正确")
        String code) {
}
