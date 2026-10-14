package com.campus.venue.availability.controller;

import com.campus.venue.availability.service.ClosureRemovalService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 管理端删除（停用）特殊关闭（docs/12 第 5.6 节，BE-2b 裁决 A6）：无请求体、无影响检查，成功 204。 */
@RestController
public class AdminClosureController {

    private final ClosureRemovalService closureRemovalService;

    public AdminClosureController(ClosureRemovalService closureRemovalService) {
        this.closureRemovalService = closureRemovalService;
    }

    @DeleteMapping(ApiPaths.BASE + "/admin/closures/{closureId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public void remove(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long closureId) {
        closureRemovalService.remove(user, closureId);
    }
}
