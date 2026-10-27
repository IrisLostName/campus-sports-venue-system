package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.reservation.dto.CancelReservationRequest;
import com.campus.venue.reservation.dto.CheckInCode;
import com.campus.venue.reservation.dto.CreateReservationRequest;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.service.CheckInCodeService;
import com.campus.venue.reservation.service.ReservationCancelService;
import com.campus.venue.reservation.service.ReservationQueryService;
import com.campus.venue.reservation.service.ReservationQueryService.Scope;
import com.campus.venue.reservation.service.ReservationService;
import com.campus.venue.reservation.service.ReservationUsageService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
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
 * 用户端预约（docs/12 第 5.3 节）。角色用方法级注解，使请求体与参数校验先于角色检查（BE-1 P1：认证 → 格式 → 角色）；
 * 业务顺序在 service 中裁决。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/reservations")
public class ReservationController {

    private final ReservationService reservationService;
    private final ReservationQueryService queryService;
    private final ReservationCancelService cancelService;
    private final ReservationUsageService usageService;
    private final CheckInCodeService checkInCodeService;

    public ReservationController(ReservationService reservationService, ReservationQueryService queryService,
            ReservationCancelService cancelService, ReservationUsageService usageService,
            CheckInCodeService checkInCodeService) {
        this.reservationService = reservationService;
        this.queryService = queryService;
        this.cancelService = cancelService;
        this.usageService = usageService;
        this.checkInCodeService = checkInCodeService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('USER')")
    public ReservationView create(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateReservationRequest request) {
        return reservationService.create(user, request);
    }

    /** scope 缺省 ALL；page ≥ 1（缺省 1）、pageSize 1–100（缺省 20）；非法 → VALIDATION_ERROR 指明参数（文案同 mock）。 */
    @GetMapping("/me")
    @PreAuthorize("hasRole('USER')")
    public PageView<ReservationView> mine(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(required = false)
            @Pattern(regexp = "CURRENT|HISTORY|ALL", message = "应为 CURRENT/HISTORY/ALL 之一") String scope,
            @RequestParam(defaultValue = "1") @Min(value = 1, message = "应为不小于 1 的整数") int page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "应为 1–100 的整数")
            @Max(value = 100, message = "应为 1–100 的整数") int pageSize) {
        return queryService.listMine(user, scope == null ? Scope.ALL : Scope.valueOf(scope), page, pageSize);
    }

    /** USER（本人）、VENUE_ADMIN（范围内）、SYS_ADMIN 均可，归属与范围在 service 中裁决。 */
    @GetMapping("/{id}")
    public ReservationView get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id) {
        return queryService.get(user, id);
    }

    /** 请求体可缺省；reason ≤ 200，空白视为未填。 */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasRole('USER')")
    public ReservationView cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id,
            @Valid @RequestBody(required = false) CancelReservationRequest request) {
        return cancelService.cancel(user, id, request);
    }

    /**
     * 契约 v1.1：本人预约的签到码，供管理员扫码签到（POST /admin/check-ins）。自助签到 POST /{id}/check-in 已删除
     * （只允许扫码签到），该路径按不存在处理（NOT_FOUND）。
     */
    @GetMapping("/{id}/check-in-code")
    @PreAuthorize("hasRole('USER')")
    public CheckInCode checkInCode(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id) {
        return checkInCodeService.issue(user, id);
    }

    /** 无请求体（带了也忽略，BE-4 O1）。 */
    @PostMapping("/{id}/check-out")
    @PreAuthorize("hasRole('USER')")
    public ReservationView checkOut(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id) {
        return usageService.checkOut(user, id);
    }
}
