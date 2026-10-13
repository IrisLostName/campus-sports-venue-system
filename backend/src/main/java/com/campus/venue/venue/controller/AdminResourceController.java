package com.campus.venue.venue.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.venue.dto.ResourceView;
import com.campus.venue.venue.dto.UpdateResourceRequest;
import com.campus.venue.venue.service.ResourceAdminService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端修改场地（docs/12 第 5.5 节）。请求体校验（含 REASON_REQUIRED）先于方法级角色注解（BE-2b 裁决 I2）；
 * 授权范围在 service 中按场地所属场馆裁决。
 */
@RestController
public class AdminResourceController {

    private final ResourceAdminService resourceAdminService;

    public AdminResourceController(ResourceAdminService resourceAdminService) {
        this.resourceAdminService = resourceAdminService;
    }

    @PatchMapping(ApiPaths.BASE + "/admin/resources/{resourceId}")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public ImpactChangeResponse<ResourceView> update(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long resourceId, @Valid @RequestBody UpdateResourceRequest request) {
        return resourceAdminService.update(user, resourceId, request);
    }
}
