package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.AdminCheckInRequest;
import com.campus.venue.reservation.dto.AdminReservationView;
import com.campus.venue.reservation.service.AdminCheckInService;
import com.campus.venue.reservation.service.CheckInCodes;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 扫码签到（docs/12 第 5.7 节，契约 v1.1，P2-1b）。角色用方法级注解，使请求体校验先于角色检查；阶段顺序为
 * 认证 → 格式 → 角色（VENUE_ADMIN、SYS_ADMIN）→ 签到码 → 范围 → 业务，后三段在 service 中裁决。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/check-ins")
public class AdminCheckInController {

    private final AdminCheckInService checkInService;

    public AdminCheckInController(AdminCheckInService checkInService) {
        this.checkInService = checkInService;
    }

    /** 请求 {code}；成功时返回与管理端预约列表项相同的 AdminReservation，不写管理员操作日志。 */
    @PostMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public AdminReservationView checkIn(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AdminCheckInRequest request) {
        return checkInService.checkIn(user, CheckInCodes.parse(request.code()));
    }
}
