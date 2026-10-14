package com.campus.venue.availability.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.CancelReasonRequired;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.common.validation.OnExistingValue;
import com.campus.venue.common.validation.ReasonCheck;
import jakarta.validation.GroupSequence;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 整体替换每周窗口请求（docs/12 第 5.6 节，BE-2b 裁决 A4）：windows 必填，可为空数组（每天都不开放）。
 * 分组顺序：字段格式（含每个窗口的字段，一次收集全部）→ REASON_REQUIRED（裁决 I2）。
 */
@GroupSequence({ReplaceWeeklyRequest.class, ReasonCheck.class})
@CancelReasonRequired(groups = ReasonCheck.class)
public record ReplaceWeeklyRequest(
        @NotNull(message = "必填")
        @Valid
        List<@NotNull(message = "必填") WeeklyWindowInput> windows,

        @OnExistingValue
        String onExistingReservations,

        @AdminReason
        String reason,

        Boolean dryRun) implements ImpactControl {
}
