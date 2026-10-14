package com.campus.venue.venue.dto;

import com.campus.venue.common.validation.AdminReason;
import com.campus.venue.common.validation.CancelReasonRequired;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.common.validation.OnExistingValue;
import com.campus.venue.common.validation.ReasonCheck;
import jakarta.validation.GroupSequence;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 修改场馆请求（docs/12 第 5.5 节，BE-2b 裁决 A1）：任意子集；字段为 null 或缺省即“不修改”（不支持清空，API-SYNC）。
 * 提交的文本字段不能为空白（与 mock updateVenue 的 textProblem 一致）。枚举以字符串接收，使非法值以 VALIDATION_ERROR 指明字段。
 * 分组顺序：字段格式 → REASON_REQUIRED（裁决 I2）。
 */
@GroupSequence({UpdateVenueRequest.class, ReasonCheck.class})
@CancelReasonRequired(groups = ReasonCheck.class)
public record UpdateVenueRequest(
        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 50, message = "不能超过 50 个字符")
        String name,

        @Pattern(regexp = "TENNIS|BADMINTON|SWIMMING|BASKETBALL|OTHER",
                message = "须为 TENNIS、BADMINTON、SWIMMING、BASKETBALL 或 OTHER")
        String venueType,

        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 100, message = "不能超过 100 个字符")
        String location,

        @Pattern(regexp = "(?s).*\\S.*", message = "不能为空")
        @Size(max = 500, message = "不能超过 500 个字符")
        String description,

        @Pattern(regexp = "OPEN|CLOSED", message = "须为 OPEN 或 CLOSED")
        String operationalStatus,

        Boolean userBookingEnabled,

        @OnExistingValue
        String onExistingReservations,

        @AdminReason
        String reason,

        Boolean dryRun) implements ImpactControl {

    /** 是否提交了只有 SYS_ADMIN 才能改的字段（name、venueType、location、operationalStatus、userBookingEnabled）。 */
    public boolean touchesSysAdminFields() {
        return name != null || venueType != null || location != null || operationalStatus != null
                || userBookingEnabled != null;
    }
}
