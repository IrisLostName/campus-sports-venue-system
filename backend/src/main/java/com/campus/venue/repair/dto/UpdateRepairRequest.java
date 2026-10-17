package com.campus.venue.repair.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * 处理报修请求（docs/12 第 5.4 节，BE-6 R4）：status 必填，为 IN_PROGRESS 或 RESOLVED；resultNote 的规则随 status 而定，
 * 见 ResultNoteMatchesStatus（与 status 等字段一同收集）。
 */
@ResultNoteMatchesStatus
public record UpdateRepairRequest(
        @NotNull(message = "必填")
        @Pattern(regexp = "IN_PROGRESS|RESOLVED", message = "应为 IN_PROGRESS/RESOLVED 之一")
        String status,

        String resultNote) {
}
