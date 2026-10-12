package com.campus.venue.venue.controller;

import com.campus.venue.availability.service.SlotService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.venue.dto.CreateVenueRequest;
import com.campus.venue.venue.dto.Occupancy;
import com.campus.venue.venue.dto.ResourceView;
import com.campus.venue.venue.dto.VenueSummary;
import com.campus.venue.venue.service.VenueService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端场馆与场地（docs/12 第 5.5 节）。角色用方法级注解，使参数与请求体校验先于角色检查（BE-1 P1）；
 * 授权范围在 service 中裁决。PATCH 场馆/场地归 BE-2b。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/venues")
public class AdminVenueController {

    private final VenueService venueService;
    private final SlotService slotService;

    public AdminVenueController(VenueService venueService, SlotService slotService) {
        this.venueService = venueService;
        this.slotService = slotService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public List<VenueSummary> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return venueService.listManageable(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('SYS_ADMIN')")
    public VenueSummary create(@Valid @RequestBody CreateVenueRequest request) {
        return venueService.create(request);
    }

    @GetMapping("/{venueId}/resources")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public List<ResourceView> resources(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long venueId) {
        return venueService.listResources(user, venueId);
    }

    /** 不限制日期范围（BE-2a A6）；date 缺失或格式错误 → VALIDATION_ERROR，先于角色检查。 */
    @GetMapping("/{venueId}/occupancy")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public Occupancy occupancy(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long venueId,
            @RequestParam("date") @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {
        return slotService.occupancy(user, venueId, date);
    }
}
