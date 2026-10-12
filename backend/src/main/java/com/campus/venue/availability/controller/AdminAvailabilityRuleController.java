package com.campus.venue.availability.controller;

import com.campus.venue.availability.dto.AvailabilityRules;
import com.campus.venue.availability.service.AvailabilityRuleService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** 管理端开放规则读取（docs/12 第 5.6 节）。周窗口替换与特殊关闭增删归 BE-2b。 */
@RestController
public class AdminAvailabilityRuleController {

    private final AvailabilityRuleService availabilityRuleService;

    public AdminAvailabilityRuleController(AvailabilityRuleService availabilityRuleService) {
        this.availabilityRuleService = availabilityRuleService;
    }

    @GetMapping(ApiPaths.BASE + "/admin/venues/{venueId}/availability-rules")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public AvailabilityRules rules(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long venueId) {
        return availabilityRuleService.activeRules(user, venueId);
    }
}
