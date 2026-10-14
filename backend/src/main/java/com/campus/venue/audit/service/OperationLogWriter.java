package com.campus.venue.audit.service;

import com.campus.venue.audit.domain.AdminOperationLog;
import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.domain.LogTargetType;
import com.campus.venue.audit.repository.AdminOperationLogRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 写管理员操作日志（BE-2b 裁决 L1–L3；BE-5、BE-6 复用）。只在调用方的事务内写入（MANDATORY）：
 * 与业务变更、批量取消一起提交或一起回滚（docs/02 第 4.1 节）。
 */
@Service
public class OperationLogWriter {

    /** action → targetType 的固定对应，与 mock logService.ts 的 LOG_TARGET 一致（裁决 L2）。 */
    private static final Map<LogAction, LogTargetType> TARGET = targets();

    private final AdminOperationLogRepository logs;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public OperationLogWriter(AdminOperationLogRepository logs, ObjectMapper objectMapper, Clock clock) {
        this.logs = logs;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** 一条日志的内容。before/after 为变更前后的对象（形状与该接口返回的 DTO 相同），可为 null。 */
    public record Entry(long adminId, Long venueId, LogAction action, Long targetId, String reason, Object before,
            Object after, List<Long> affectedReservationIds) {
    }

    /** 快照形状统一为 {"object": 对象, "affectedReservationIds": [..]}（FE-1 裁决 A9、本包裁决 L3）。 */
    @Transactional(propagation = Propagation.MANDATORY)
    public void write(Entry entry) {
        AdminOperationLog log = new AdminOperationLog();
        log.setAdminId(entry.adminId());
        log.setVenueId(entry.venueId());
        log.setAction(entry.action());
        log.setTargetType(targetTypeOf(entry.action()));
        log.setTargetId(entry.targetId());
        log.setReason(entry.reason());
        log.setBeforeSnapshot(snapshot(entry.before(), entry.affectedReservationIds()));
        log.setAfterSnapshot(snapshot(entry.after(), entry.affectedReservationIds()));
        log.setCreatedAt(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        logs.saveAndFlush(log);
    }

    public static LogTargetType targetTypeOf(LogAction action) {
        return TARGET.get(action);
    }

    private JsonNode snapshot(Object object, List<Long> affectedReservationIds) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("object", object);
        snapshot.put("affectedReservationIds", affectedReservationIds);
        return objectMapper.valueToTree(snapshot);
    }

    private static Map<LogAction, LogTargetType> targets() {
        Map<LogAction, LogTargetType> map = new EnumMap<>(LogAction.class);
        map.put(LogAction.RESERVATION_CANCEL, LogTargetType.RESERVATION);
        map.put(LogAction.RESERVATION_REASSIGN_RESOURCE, LogTargetType.RESERVATION);
        map.put(LogAction.RESERVATION_REASSIGN_USER, LogTargetType.RESERVATION);
        map.put(LogAction.RESOURCE_STATUS_CHANGE, LogTargetType.RESOURCE);
        map.put(LogAction.RESOURCE_COUNT_CHANGE, LogTargetType.VENUE);
        map.put(LogAction.VENUE_UPDATE, LogTargetType.VENUE);
        map.put(LogAction.RULE_WEEKLY_UPDATE, LogTargetType.RULE);
        map.put(LogAction.CLOSURE_ADD, LogTargetType.RULE);
        map.put(LogAction.CLOSURE_REMOVE, LogTargetType.RULE);
        map.put(LogAction.SCOPE_UPDATE, LogTargetType.SCOPE);
        map.put(LogAction.USER_CREATE, LogTargetType.USER);
        map.put(LogAction.USER_STATUS_CHANGE, LogTargetType.USER);
        map.put(LogAction.ANNOUNCEMENT_PUBLISH, LogTargetType.ANNOUNCEMENT);
        map.put(LogAction.ANNOUNCEMENT_ARCHIVE, LogTargetType.ANNOUNCEMENT);
        map.put(LogAction.REPAIR_UPDATE, LogTargetType.REPAIR);
        return map;
    }
}
