package com.campus.venue.availability.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.availability.dto.Closure;
import com.campus.venue.availability.repository.AvailabilityRuleRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.service.VenueLookup;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 删除（停用）特殊关闭（docs/12 第 5.6 节，BE-2b 裁决 A6），与 mock ruleService.ts 的 removeClosure 一致：无请求体、
 * 无影响检查。角色在控制器；这里依次：不存在、不是关闭规则或已非 ACTIVE → NOT_FOUND → 锁定所属场馆行 → 授权范围 →
 * 置 INACTIVE → 写 CLOSURE_REMOVE（before 为该关闭规则，after 对象为 null）。
 */
@Service
public class ClosureRemovalService {

    private final AvailabilityRuleRepository rules;
    private final VenueLookup venueLookup;
    private final OperationLogWriter logWriter;

    public ClosureRemovalService(AvailabilityRuleRepository rules, VenueLookup venueLookup,
            OperationLogWriter logWriter) {
        this.rules = rules;
        this.venueLookup = venueLookup;
        this.logWriter = logWriter;
    }

    @Transactional
    public void remove(AuthenticatedUser user, long closureId) {
        // 先只取所属场馆 id，锁定场馆行之后再读取规则，并发删除时后到者得到 NOT_FOUND（裁决 G8）
        long venueId = rules.findVenueIdOf(closureId, AvailabilityRuleType.CLOSURE, AvailabilityRuleStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Venue venue = venueLookup.lockForAdmin(user, venueId);
        AvailabilityRule rule = rules.findById(closureId)
                .filter(found -> found.getStatus() == AvailabilityRuleStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Closure before = AvailabilityRuleService.toClosure(rule);
        rule.setStatus(AvailabilityRuleStatus.INACTIVE);
        rules.saveAndFlush(rule);
        logWriter.write(new OperationLogWriter.Entry(user.id(), venue.getId(), LogAction.CLOSURE_REMOVE, rule.getId(),
                null, before, null, List.of()));
    }
}
