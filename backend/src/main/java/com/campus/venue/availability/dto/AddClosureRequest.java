package com.campus.venue.availability.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.CancelReasonRequired;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.common.validation.OnExistingValue;
import com.campus.venue.common.validation.ReasonCheck;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

/**
 * 新增特殊关闭请求（docs/12 第 5.6 节，BE-2b 裁决 A5）：日期由全局 JSON 配置严格解析（yyyy-MM-dd）；
 * resourceId 为空 = 整馆关闭；reason 同时作为关闭原因与 CANCEL 原因。分组顺序：字段格式 → REASON_REQUIRED。
 */
@GroupSequence({AddClosureRequest.class, ReasonCheck.class})
@CancelReasonRequired(groups = ReasonCheck.class)
public record AddClosureRequest(
        @NotNull(message = "必填")
        LocalDate startDate,

        @NotNull(message = "必填")
        LocalDate endDate,

        @Positive(message = "应为正整数")
        Long resourceId,

        @AdminReason
        String reason,

        @OnExistingValue
        String onExistingReservations,

        Boolean dryRun) implements ImpactControl {
}
