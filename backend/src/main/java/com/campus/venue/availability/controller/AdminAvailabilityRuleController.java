package com.campus.venue.availability.controller;

import com.campus.venue.availability.dto.AddClosureRequest;
import com.campus.venue.availability.dto.AvailabilityRules;
import com.campus.venue.availability.dto.Closure;
import com.campus.venue.availability.dto.ReplaceWeeklyRequest;
import com.campus.venue.availability.dto.WeeklyWindow;
import com.campus.venue.availability.service.AvailabilityRuleAdminService;
import com.campus.venue.availability.service.AvailabilityRuleService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端开放规则（docs/12 第 5.6 节）：读取、周窗口整体替换、新增特殊关闭（BE-2b，带影响检查）。
 * 请求体校验（含 REASON_REQUIRED）先于方法级角色注解（BE-2b 裁决 I2）；授权范围在 service 中裁决。
 */
@RestController
public class AdminAvailabilityRuleController {

    private final AvailabilityRuleService availabilityRuleService;
    private final AvailabilityRuleAdminService availabilityRuleAdminService;

    public AdminAvailabilityRuleController(AvailabilityRuleService availabilityRuleService,
            AvailabilityRuleAdminService availabilityRuleAdminService) {
        this.availabilityRuleService = availabilityRuleService;
        this.availabilityRuleAdminService = availabilityRuleAdminService;
    }

    @GetMapping(ApiPaths.BASE + "/admin/venues/{venueId}/availability-rules")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public AvailabilityRules rules(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long venueId) {
        return availabilityRuleService.activeRules(user, venueId);
    }

    /** BE-2b A4：整体替换每周窗口。 */
    @PutMapping(ApiPaths.BASE + "/admin/venues/{venueId}/availability-rules/weekly")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public ImpactChangeResponse<List<WeeklyWindow>> replaceWeekly(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long venueId, @Valid @RequestBody ReplaceWeeklyRequest request) {
        return availabilityRuleAdminService.replaceWeekly(user, venueId, request);
    }

    /** BE-2b A5：实际新建返回 201；dryRun 没有新建任何对象，返回 200（API-SYNC）。 */
    @PostMapping(ApiPaths.BASE + "/admin/venues/{venueId}/closures")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public ResponseEntity<ImpactChangeResponse<Closure>> addClosure(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long venueId, @Valid @RequestBody AddClosureRequest request) {
        ImpactChangeResponse<Closure> response = availabilityRuleAdminService.addClosure(user, venueId, request);
        return ResponseEntity.status(response.applied() ? HttpStatus.CREATED : HttpStatus.OK).body(response);
    }
}
