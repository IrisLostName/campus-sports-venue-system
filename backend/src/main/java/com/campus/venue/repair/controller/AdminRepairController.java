package com.campus.venue.repair.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.repair.domain.RepairStatus;
import com.campus.venue.repair.dto.AdminRepairsQuery;
import com.campus.venue.repair.dto.RepairReportView;
import com.campus.venue.repair.dto.UpdateRepairRequest;
import com.campus.venue.repair.service.RepairAdminService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 管理端报修（docs/12 第 5.4 节，BE-6 R3、R4）：VA（范围内）、SA；校验先于角色检查（方法级注解）。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/repairs")
public class AdminRepairController {

    private final RepairAdminService adminService;

    public AdminRepairController(RepairAdminService adminService) {
        this.adminService = adminService;
    }

    /** R3：返回 Page&lt;RepairReport&gt;；每页固定 20 条。 */
    @GetMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public PageView<RepairReportView> list(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid AdminRepairsQuery query) {
        RepairStatus status = query.status() == null ? null : RepairStatus.valueOf(query.status());
        return adminService.list(user, query.venueId(), status, query.pageOrDefault());
    }

    /** R4：返回更新后的 RepairReport。 */
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public RepairReportView update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id,
            @Valid @RequestBody UpdateRepairRequest request) {
        return adminService.update(user, id, request);
    }
}
