package com.campus.venue.reservation.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.OverrideReason;
import com.campus.venue.common.validation.ReasonCheck;
import com.campus.venue.common.validation.ReasonRequired;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * 资源改派请求（docs/12 第 5.7 节，BE-5 A3）：目标场地、日期（严格 yyyy-MM-dd）、开始时刻（严格 HH:mm）与必填原因。
 * 分组顺序：字段格式 → REASON_REQUIRED（BE-5 C1）。
 */
@GroupSequence({ReassignResourceRequest.class, ReasonCheck.class})
@ReasonRequired(groups = ReasonCheck.class)
public record ReassignResourceRequest(
        @NotNull(message = "必填")
        @Positive(message = "应为正整数")
        Long resourceId,

        @NotNull(message = "必填")
        LocalDate serviceDate,

        @NotNull(message = "必填")
        LocalTime startTime,

        @AdminReason
        String reason) implements OverrideReason {
}
