package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.venue.repository.ResourceRepository;
import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 管理员覆盖的公共前置（docs/10 第 6 节，BE-5 C1 角色之后的部分）：锁定预约行 → 不存在 NOT_FOUND → 授权范围
 * FORBIDDEN_SCOPE（场馆为预约场地所属场馆，details.venueId）→ 有效状态不是 CONFIRMED 或结束时刻不晚于现在
 * INVALID_STATE（details.status 为有效状态）→（仅两类改派）已签到 ALREADY_CHECKED_IN。
 * 与 mock 的 manageableReservation、requireNotCheckedIn（adminReservationService.ts）一致。
 * 只锁预约行，不锁用户行与场馆行（BE-5 C3，不破坏 G8 的加锁顺序）。事务由调用方提供。
 */
@Component
public class AdminOverrideGuard {

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final ResourceRepository resources;
    private final DisplayStatusCalculator calculator;
    private final VenueScopeGuard venueScopeGuard;

    public AdminOverrideGuard(ReservationRepository reservations, UsageRecordRepository usageRecords,
            ResourceRepository resources, DisplayStatusCalculator calculator, VenueScopeGuard venueScopeGuard) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.resources = resources;
        this.calculator = calculator;
        this.venueScopeGuard = venueScopeGuard;
    }

    /** 已锁定、可被覆盖的预约及其所属场馆。 */
    public record Managed(Reservation reservation, long venueId) {
    }

    /** 取消：已签到未结束的预约也可取消（docs/10 第 6 节）。 */
    public Managed lockCancellable(AuthenticatedUser user, long id, LocalDateTime now) {
        return lockManaged(user, id, now).managed();
    }

    /** 资源改派、人员改派：另要求预约无签到记录。 */
    public Managed lockReassignable(AuthenticatedUser user, long id, LocalDateTime now) {
        Locked locked = lockManaged(user, id, now);
        if (locked.usage() != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN);
        }
        return locked.managed();
    }

    private record Locked(Managed managed, UsageRecord usage) {
    }

    private Locked lockManaged(AuthenticatedUser user, long id, LocalDateTime now) {
        // 锁定预约行（SELECT … FOR UPDATE），与并发的取消、签到、清扫及其他覆盖串行
        Reservation reservation = reservations.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        long venueId = resources.findById(reservation.getResourceId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND)).getVenueId();
        venueScopeGuard.requireVenueAccess(user, venueId);
        UsageRecord usage = usageRecords.findByReservationId(id).orElse(null);
        ReservationStatus effective = calculator.effectiveStatus(reservation, usage, now);
        // “结束时刻不晚于现在”为防御性判断：库中 CONFIRMED 且已结束的预约，有效状态必为 NO_SHOW（无签到）或
        // COMPLETED（有签到），已被前一个条件挡住，此处不可达；保留以与 mock 的 manageableReservation 一致（BE-5 裁决 Q9）
        LocalDateTime end = LocalDateTime.of(reservation.getServiceDate(), reservation.getEndTime());
        if (effective != ReservationStatus.CONFIRMED || !end.isAfter(now)) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", effective.name()));
        }
        return new Locked(new Managed(reservation, venueId), usage);
    }
}
