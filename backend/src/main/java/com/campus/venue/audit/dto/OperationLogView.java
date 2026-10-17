package com.campus.venue.audit.dto;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.domain.LogTargetType;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;

/**
 * 操作记录（docs/12 第 4 节 OperationLog，BE-6 L2）：adminName 为操作者姓名（批量装载）；before、after 为快照 JSON 原样
 * （对象，不是字符串），库中为空时为 null。
 */
public record OperationLogView(
        long id,
        long adminId,
        String adminName,
        Long venueId,
        LogAction action,
        LogTargetType targetType,
        Long targetId,
        String reason,
        JsonNode before,
        JsonNode after,
        LocalDateTime createdAt) {
}
