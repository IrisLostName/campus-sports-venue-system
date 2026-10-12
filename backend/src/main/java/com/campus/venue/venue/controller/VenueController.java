package com.campus.venue.venue.controller;

import com.campus.venue.availability.service.SlotService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.venue.dto.VenueSlots;
import com.campus.venue.venue.dto.VenueSummary;
import com.campus.venue.venue.service.VenueService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 用户端场馆与时段（docs/12 第 5.2 节），任意已登录角色可用。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/venues")
public class VenueController {

    private final VenueService venueService;
    private final SlotService slotService;

    public VenueController(VenueService venueService, SlotService slotService) {
        this.venueService = venueService;
        this.slotService = slotService;
    }

    @GetMapping
    public List<VenueSummary> list() {
        return venueService.listAll();
    }

    /** date 须为 yyyy-MM-dd（严格解析）；缺失或格式错误 → VALIDATION_ERROR，fields.date。 */
    @GetMapping("/{venueId}/slots")
    public VenueSlots slots(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long venueId,
            @RequestParam("date") @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {
        return slotService.userSlots(user, venueId, date);
    }
}
