package com.campus.venue.venue.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.CancelReasonRequired;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.common.validation.OnExistingValue;
import com.campus.venue.common.validation.ReasonCheck;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 设定场地数量请求（docs/12 第 5.5 节，BE-2b 裁决 A3）：count 0–50；namePrefix、resourceType 可选，
 * 只在需要新建场地时使用。分组顺序：字段格式 → REASON_REQUIRED（裁决 I2）。
 */
@GroupSequence({SetResourceCountRequest.class, ReasonCheck.class})
@CancelReasonRequired(groups = ReasonCheck.class)
public record SetResourceCountRequest(
        @NotNull(message = "必填")
        @Min(value = 0, message = "应为 0–50 的整数")
        @Max(value = 50, message = "应为 0–50 的整数")
        Integer count,

        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 40, message = "不能超过 40 个字符")
        String namePrefix,

        @Pattern(regexp = "COURT|LANE|OTHER", message = "须为 COURT、LANE 或 OTHER")
        String resourceType,

        @OnExistingValue
        String onExistingReservations,

        @AdminReason
        String reason,

        Boolean dryRun) implements ImpactControl {
}
