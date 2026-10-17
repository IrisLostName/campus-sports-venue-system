package com.campus.venue.reservation.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.OverrideReason;
import com.campus.venue.common.validation.ReasonCheck;
import com.campus.venue.common.validation.ReasonRequired;
import jakarta.validation.GroupSequence;

/**
 * 管理员取消预约请求（docs/12 第 5.7 节，BE-5 A2）：reason 必填、非空白、≤ 200，原样写入 admin_note 与日志。
 * 分组顺序：字段格式 → REASON_REQUIRED（BE-5 C1）。
 */
@GroupSequence({AdminCancelRequest.class, ReasonCheck.class})
@ReasonRequired(groups = ReasonCheck.class)
public record AdminCancelRequest(
        @AdminReason
        String reason) implements OverrideReason {
}
