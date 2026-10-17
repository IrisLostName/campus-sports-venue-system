package com.campus.venue.reservation.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.OverrideReason;
import com.campus.venue.common.validation.ReasonCheck;
import com.campus.venue.common.validation.ReasonRequired;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 人员改派请求（docs/12 第 5.7 节，BE-5 A4）：目标用户 id 与必填原因。分组顺序：字段格式 → REASON_REQUIRED（BE-5 C1）。
 */
@GroupSequence({ReassignUserRequest.class, ReasonCheck.class})
@ReasonRequired(groups = ReasonCheck.class)
public record ReassignUserRequest(
        @NotNull(message = "必填")
        @Positive(message = "应为正整数")
        Long userId,

        @AdminReason
        String reason) implements OverrideReason {
}
