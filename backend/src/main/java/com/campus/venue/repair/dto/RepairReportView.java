package com.campus.venue.repair.dto;

import com.campus.venue.repair.domain.RepairStatus;
import java.time.LocalDateTime;

/** 报修（docs/12 第 4 节 RepairReport）：venueName、resourceName、reporterName（姓名）由批量装载填入。 */
public record RepairReportView(
        long id,
        long venueId,
        String venueName,
        Long resourceId,
        String resourceName,
        long reporterId,
        String reporterName,
        String description,
        RepairStatus status,
        String resultNote,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
