package com.campus.venue.common.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * 预约参数（docs/03 第 4.3 节，环境变量见 docs/14 第 3.1 节）。均须为正整数，非法时启动失败（BE-1 A4）。
 * slotMinutes 固定 90，不可配置，因此不在这里。
 */
@Validated
@ConfigurationProperties("app.booking")
public record BookingProperties(
        @NotNull @Positive Integer advanceDays,
        @NotNull @Positive Integer cancelDeadlineMinutes,
        @NotNull @Positive Integer checkinOpenBeforeMinutes,
        @NotNull @Positive Integer checkinCloseAfterMinutes,
        @NotNull @Positive Integer checkoutGraceMinutes,
        @NotNull @Positive Integer maxActivePerUser) {
}
