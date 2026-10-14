package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.availability.dto.AvailabilityRules;
import com.campus.venue.availability.dto.Closure;
import com.campus.venue.availability.dto.WeeklyWindow;
import com.campus.venue.availability.repository.AvailabilityRuleRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.service.VenueLookup;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 开放规则读取（BE-2a A7）。写入（周窗口替换、特殊关闭增删）归 BE-2b。 */
@Service
public class AvailabilityRuleService {

    private final VenueLookup venueLookup;
    private final AvailabilityRuleRepository rules;
    private final VenueScopeGuard venueScopeGuard;

    public AvailabilityRuleService(VenueLookup venueLookup, AvailabilityRuleRepository rules,
            VenueScopeGuard venueScopeGuard) {
        this.venueLookup = venueLookup;
        this.rules = rules;
        this.venueScopeGuard = venueScopeGuard;
    }

    /**
     * 场馆不存在 NOT_FOUND → 授权范围 FORBIDDEN_SCOPE；返回 ACTIVE 的规则。
     * weekly 按星期、开始时间排序，closures 按开始日期、再按 id 排序（与 mock activeWeekly、activeClosures 一致）。
     */
    @Transactional(readOnly = true)
    public AvailabilityRules activeRules(AuthenticatedUser user, long venueId) {
        Venue venue = venueLookup.require(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        List<WeeklyWindow> weekly = rules.findByVenueIdAndRuleTypeAndStatusOrderByWeekdayAscOpenTimeAsc(venue.getId(),
                AvailabilityRuleType.WEEKLY, AvailabilityRuleStatus.ACTIVE).stream()
                .map(AvailabilityRuleService::toWeekly)
                .toList();
        List<Closure> closures = rules.findByVenueIdAndRuleTypeAndStatusOrderByStartDateAscIdAsc(venue.getId(),
                AvailabilityRuleType.CLOSURE, AvailabilityRuleStatus.ACTIVE).stream()
                .map(AvailabilityRuleService::toClosure)
                .toList();
        return new AvailabilityRules(weekly, closures);
    }

    static WeeklyWindow toWeekly(AvailabilityRule rule) {
        return new WeeklyWindow(rule.getId(), rule.getWeekday(), rule.getOpenTime(), rule.getCloseTime());
    }

    static Closure toClosure(AvailabilityRule rule) {
        return new Closure(rule.getId(), rule.getVenueId(), rule.getResourceId(), rule.getStartDate(),
                rule.getEndDate(), rule.getReason());
    }
}
