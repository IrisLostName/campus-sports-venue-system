package com.campus.venue.repair.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.repair.dto.CreateRepairRequest;
import com.campus.venue.repair.dto.RepairReportView;
import com.campus.venue.repair.service.RepairService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 用户端报修（docs/12 第 5.4 节，BE-6 R1、R2）：仅 USER；请求体校验先于角色检查（方法级注解）。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/repairs")
public class RepairController {

    private final RepairService repairService;

    public RepairController(RepairService repairService) {
        this.repairService = repairService;
    }

    /** R1：返回 201 RepairReport（SUBMITTED）。 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('USER')")
    public RepairReportView create(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateRepairRequest request) {
        return repairService.create(user.id(), request);
    }

    /** R2：自己提交的 RepairReport[]。 */
    @GetMapping("/me")
    @PreAuthorize("hasRole('USER')")
    public List<RepairReportView> mine(@AuthenticationPrincipal AuthenticatedUser user) {
        return repairService.listMine(user.id());
    }
}
