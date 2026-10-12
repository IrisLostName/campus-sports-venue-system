package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.reservation.dto.CreateReservationRequest;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.service.ReservationService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户端预约（docs/12 第 5.3 节）。角色用方法级注解，使请求体与参数校验先于角色检查（BE-1 P1：认证 → 格式 → 角色）；
 * 业务顺序在 service 中裁决。签到、签退归 BE-4。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('USER')")
    public ReservationView create(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateReservationRequest request) {
        return reservationService.create(user, request);
    }
}
