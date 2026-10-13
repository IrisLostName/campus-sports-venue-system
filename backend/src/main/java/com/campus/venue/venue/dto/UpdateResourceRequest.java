package com.campus.venue.venue.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.CancelReasonRequired;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.common.validation.OnExistingValue;
import com.campus.venue.common.validation.ReasonCheck;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 修改场地请求（docs/12 第 5.5 节，BE-2b 裁决 A2）：任意子集；字段为 null 或缺省即“不修改”。
 * 分组顺序：字段格式 → REASON_REQUIRED（裁决 I2）。
 */
@GroupSequence({UpdateResourceRequest.class, ReasonCheck.class})
@CancelReasonRequired(groups = ReasonCheck.class)
public record UpdateResourceRequest(
        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 50, message = "不能超过 50 个字符")
        String name,

        @Min(value = 0, message = "应为不小于 0 的整数")
        Integer sortOrder,

        @Pattern(regexp = "OPEN|MAINTENANCE|DISABLED", message = "须为 OPEN、MAINTENANCE 或 DISABLED")
        String operationalStatus,

        @OnExistingValue
        String onExistingReservations,

        @AdminReason
        String reason,

        Boolean dryRun) implements ImpactControl {
}
