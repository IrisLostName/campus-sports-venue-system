package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.dto.AdminReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.service.CheckInCodes.Parsed;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.repository.ResourceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 扫码签到（docs/12 第 5.7 节 POST /admin/check-ins，契约 v1.1，P2-1b）。认证、格式、角色 VENUE_ADMIN / SYS_ADMIN 在过滤器
 * 与控制器完成；这里依次：签到码（预约不存在或签到标识与预约人不符，一律 CHECKIN_CODE_INVALID）→ 范围（FORBIDDEN_SCOPE，
 * details.venueId 为预约场地所属场馆）→ 签到规则（ReservationUsageService.checkInScanned，与原自助签到同一份规则与
 * 使用记录写入）。只锁预约行；用户的签到标识建立后不再修改，读取不加锁（不改变 BE-4 G6 的加锁顺序）。
 */
@Service
public class AdminCheckInService {

    private final ReservationRepository reservations;
    private final AppUserRepository users;
    private final ResourceRepository resources;
    private final VenueScopeGuard venueScopeGuard;
    private final ReservationUsageService usageService;

    public AdminCheckInService(ReservationRepository reservations, AppUserRepository users,
            ResourceRepository resources, VenueScopeGuard venueScopeGuard, ReservationUsageService usageService) {
        this.reservations = reservations;
        this.users = users;
        this.resources = resources;
        this.venueScopeGuard = venueScopeGuard;
        this.usageService = usageService;
    }

    @Transactional
    public AdminReservationView checkIn(AuthenticatedUser admin, Parsed code) {
        Reservation reservation = lockByCode(code);
        long venueId = resources.findById(reservation.getResourceId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND)).getVenueId();
        venueScopeGuard.requireVenueAccess(admin, venueId);
        return usageService.checkInScanned(reservation);
    }

    /**
     * 按签到码锁定预约行（SELECT … FOR UPDATE，与签退、取消、清扫相同的行锁）。预约不存在与签到标识不符抛同一个
     * CHECKIN_CODE_INVALID（不带 details），不区分两种情况，以免探测预约 id（P2-1b 裁决第 2 节）。
     */
    private Reservation lockByCode(Parsed code) {
        Reservation reservation = reservations.findByIdForUpdate(code.reservationId()).orElse(null);
        boolean matches = reservation != null && users.findCheckInUuidById(reservation.getUserId())
                .map(code.checkInUuid()::equals).orElse(false);
        if (!matches) {
            throw new BusinessException(ErrorCode.CHECKIN_CODE_INVALID);
        }
        return reservation;
    }
}
