package com.campus.venue.reservation.controller;

import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.dto.AdminCancelRequest;
import com.campus.venue.reservation.dto.AdminReservationView;
import com.campus.venue.reservation.dto.AdminReservationsQuery;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.service.AdminReservationQueryService;
import com.campus.venue.reservation.service.AdminReservationQueryService.Query;
import com.campus.venue.reservation.service.AdminReservationService;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端预约管理（docs/12 第 5.7 节，BE-5）。角色用方法级注解，使查询参数与请求体校验（含 REASON_REQUIRED）先于角色检查
 * （BE-5 C1：认证 → 格式 → REASON_REQUIRED → 角色）；预约是否存在、授权范围与业务规则在 service 中裁决。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/reservations")
public class AdminReservationController {

    private final AdminReservationQueryService queryService;
    private final AdminReservationService adminReservationService;

    public AdminReservationController(AdminReservationQueryService queryService,
            AdminReservationService adminReservationService) {
        this.queryService = queryService;
        this.adminReservationService = adminReservationService;
    }

    /** A1：返回 Page&lt;AdminReservation&gt;；VENUE_ADMIN 只含授权场馆，给了越权的 venueId → FORBIDDEN_SCOPE。 */
    @GetMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public PageView<AdminReservationView> list(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid AdminReservationsQuery query) {
        ReservationStatus status = query.status() == null ? null : ReservationStatus.valueOf(query.status());
        return queryService.list(user, new Query(query.venueId(), query.dateFrom(), query.dateTo(), status,
                query.keyword(), query.pageOrDefault(), query.pageSizeOrDefault()));
    }

    /** A2：请求 {reason}（必填）；返回 ADMIN_CANCELLED 的 Reservation。已签到未结束的预约也可取消。 */
    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public ReservationView cancel(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id,
            @Valid @RequestBody AdminCancelRequest request) {
        return adminReservationService.cancel(user, id, request);
    }
}
