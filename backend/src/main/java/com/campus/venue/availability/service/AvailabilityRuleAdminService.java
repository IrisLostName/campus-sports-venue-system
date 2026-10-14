package com.campus.venue.availability.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.availability.domain.WindowSpec;
import com.campus.venue.availability.dto.AddClosureRequest;
import com.campus.venue.availability.dto.Closure;
import com.campus.venue.availability.dto.ReplaceWeeklyRequest;
import com.campus.venue.availability.dto.WeeklyWindow;
import com.campus.venue.availability.repository.AvailabilityRuleRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.reservation.service.AffectedScope;
import com.campus.venue.reservation.service.ImpactChangeService;
import com.campus.venue.reservation.service.ImpactPlan;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.service.VenueLookup;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 开放规则写入（docs/12 第 5.6 节，BE-2b 裁决 A4、A5）：周窗口整体替换、新增特殊关闭，均经影响检查。
 * 与 mock ruleService.ts 的 replaceWeekly、addClosure 一致。认证、格式、REASON_REQUIRED、角色在过滤器与控制器完成；
 * 这里依次：锁定场馆行（NOT_FOUND）→ 授权范围 → 业务校验 → 影响检查 → 执行并写日志。
 */
@Service
public class AvailabilityRuleAdminService {

    static final String RESOURCE_NOT_IN_VENUE = "场地不属于该场馆";

    private final VenueLookup venueLookup;
    private final AvailabilityRuleRepository rules;
    private final ResourceRepository resources;
    private final OpeningRuleValidator validator;
    private final ImpactChangeService impactChangeService;
    private final Clock clock;

    public AvailabilityRuleAdminService(VenueLookup venueLookup, AvailabilityRuleRepository rules,
            ResourceRepository resources, OpeningRuleValidator validator, ImpactChangeService impactChangeService,
            Clock clock) {
        this.venueLookup = venueLookup;
        this.rules = rules;
        this.resources = resources;
        this.validator = validator;
        this.impactChangeService = impactChangeService;
        this.clock = clock;
    }

    /**
     * A4：校验（RULE_INVALID）→ 影响范围为开始时间不再是新窗口在其星期切出的时段的预约（与 mock affectedByWindows 一致，
     * 不考虑关闭规则）→ 原 ACTIVE 的 WEEKLY 全部置 INACTIVE、按请求插入新规则 → 写 RULE_WEEKLY_UPDATE（target_id 为空）。
     */
    @Transactional
    public ImpactChangeResponse<List<WeeklyWindow>> replaceWeekly(AuthenticatedUser user, long venueId,
            ReplaceWeeklyRequest request) {
        Venue venue = venueLookup.lockForAdmin(user, venueId);
        List<WindowSpec> specs = request.windows().stream()
                .map(window -> new WindowSpec(window.weekday(), LocalTime.parse(window.openTime()),
                        LocalTime.parse(window.closeTime())))
                .toList();
        validator.validateWeekly(specs);
        AffectedScope scope = AffectedScope.matching(resourceIdsOf(venue), outsideWindows(specs));
        List<WeeklyWindow> before = activeWeekly(venue);
        return impactChangeService.apply(user, request, scope, new ImpactPlan<>(venue.getId(),
                LogAction.RULE_WEEKLY_UPDATE, before, data -> null, () -> commitWeekly(user, venue, specs)));
    }

    /**
     * A5：结束日期早于开始日期 RULE_INVALID → 场地不属于该场馆 VALIDATION_ERROR（二者在授权范围之后，与 mock 一致）→
     * 影响范围为该场馆（或该场地）服务日期落在 [startDate, endDate] 的预约 → 插入 ACTIVE 的 CLOSURE → 写 CLOSURE_ADD。
     * 允许过去日期（FE-1 裁决 A8）。
     */
    @Transactional
    public ImpactChangeResponse<Closure> addClosure(AuthenticatedUser user, long venueId, AddClosureRequest request) {
        Venue venue = venueLookup.lockForAdmin(user, venueId);
        validator.validateClosure(request.startDate(), request.endDate());
        Long resourceId = request.resourceId();
        if (resourceId != null && resources.findById(resourceId)
                .filter(resource -> resource.getVenueId().equals(venue.getId())).isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    Map.of("fields", Map.of("resourceId", RESOURCE_NOT_IN_VENUE)));
        }
        List<Long> resourceIds = resourceId == null ? resourceIdsOf(venue) : List.of(resourceId);
        AffectedScope scope = AffectedScope.dates(resourceIds, request.startDate(), request.endDate());
        return impactChangeService.apply(user, request, scope, new ImpactPlan<>(venue.getId(),
                LogAction.CLOSURE_ADD, null, Closure::id, () -> commitClosure(user, venue, request)));
    }

    /** 每个星期的新窗口切出的时段开始时刻；预约的开始时刻不在其中即受影响。 */
    private static Predicate<Reservation> outsideWindows(List<WindowSpec> specs) {
        Map<Integer, Set<LocalTime>> starts = new HashMap<>();
        for (WindowSpec spec : specs) {
            SlotDerivation.sliceWindow(spec.openTime(), spec.closeTime()).forEach(slot ->
                    starts.computeIfAbsent(spec.weekday(), weekday -> new HashSet<>()).add(slot.start()));
        }
        return reservation -> !starts.getOrDefault(reservation.getServiceDate().getDayOfWeek().getValue(), Set.of())
                .contains(reservation.getStartTime());
    }

    private List<WeeklyWindow> commitWeekly(AuthenticatedUser user, Venue venue, List<WindowSpec> specs) {
        List<AvailabilityRule> old = rules.findByVenueIdAndRuleTypeAndStatusOrderByWeekdayAscOpenTimeAsc(
                venue.getId(), AvailabilityRuleType.WEEKLY, AvailabilityRuleStatus.ACTIVE);
        old.forEach(rule -> rule.setStatus(AvailabilityRuleStatus.INACTIVE));
        rules.saveAllAndFlush(old);
        LocalDateTime now = now();
        List<AvailabilityRule> created = specs.stream().map(spec -> {
            AvailabilityRule rule = newRule(user, venue, AvailabilityRuleType.WEEKLY, now);
            rule.setWeekday((short) spec.weekday());
            rule.setOpenTime(spec.openTime());
            rule.setCloseTime(spec.closeTime());
            return rule;
        }).toList();
        rules.saveAllAndFlush(created);
        return activeWeekly(venue);
    }

    private Closure commitClosure(AuthenticatedUser user, Venue venue, AddClosureRequest request) {
        AvailabilityRule rule = newRule(user, venue, AvailabilityRuleType.CLOSURE, now());
        rule.setStartDate(request.startDate());
        rule.setEndDate(request.endDate());
        rule.setResourceId(request.resourceId());
        rule.setReason(request.reasonOrNull());
        rules.saveAndFlush(rule);
        return AvailabilityRuleService.toClosure(rule);
    }

    private static AvailabilityRule newRule(AuthenticatedUser user, Venue venue, AvailabilityRuleType type,
            LocalDateTime now) {
        AvailabilityRule rule = new AvailabilityRule();
        rule.setVenueId(venue.getId());
        rule.setRuleType(type);
        rule.setStatus(AvailabilityRuleStatus.ACTIVE);
        rule.setCreatedBy(user.id());
        rule.setCreatedAt(now);
        return rule;
    }

    /** ACTIVE 的每周窗口，按星期、开始时间排序（与 mock activeWeekly 一致）。 */
    private List<WeeklyWindow> activeWeekly(Venue venue) {
        return rules.findByVenueIdAndRuleTypeAndStatusOrderByWeekdayAscOpenTimeAsc(venue.getId(),
                AvailabilityRuleType.WEEKLY, AvailabilityRuleStatus.ACTIVE).stream()
                .map(AvailabilityRuleService::toWeekly)
                .toList();
    }

    private List<Long> resourceIdsOf(Venue venue) {
        return resources.findByVenueIdOrderBySortOrderAscIdAsc(venue.getId()).stream().map(Resource::getId).toList();
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
