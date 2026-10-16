package com.campus.venue.reservation.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.dto.AdminCancelRequest;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.security.AuthenticatedUser;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 管理员覆盖（docs/10 第 6 节、docs/12 第 5.7 节，BE-5 A2–A4；ACC-M3-06）。认证、格式、REASON_REQUIRED、角色在过滤器与
 * 控制器完成；预约存在、授权范围、状态由 AdminOverrideGuard 裁决。每次成功都在同一事务内写一行操作日志
 * （快照为变更前后的 Reservation 与 [预约 id]，与 mock 的 snapshot(before/after, [record.id]) 一致）；失败不写。
 * reason 原样写入 admin_note（覆盖原值）与日志；被修改的预约行 updated_at 取 Clock。
 */
@Service
public class AdminReservationService {

    private final AdminOverrideGuard guard;
    private final ReservationRepository reservations;
    private final ReservationViewMapper mapper;
    private final OperationLogWriter logWriter;
    private final Clock clock;

    public AdminReservationService(AdminOverrideGuard guard, ReservationRepository reservations,
            ReservationViewMapper mapper, OperationLogWriter logWriter, Clock clock) {
        this.guard = guard;
        this.reservations = reservations;
        this.mapper = mapper;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    /** A2：ADMIN_CANCELLED，cancelled_at 取 Clock，cancelled_by 为当前管理员；cancel_reason 不写（与 BE-2b 批量取消一致）。 */
    @Transactional
    public ReservationView cancel(AuthenticatedUser user, long id, AdminCancelRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        Reservation reservation = guard.lockCancellable(user, id, now).reservation();
        ReservationView before = mapper.toView(reservation, now);
        LocalDateTime timestamp = timestamp(now);
        reservation.setStatus(ReservationStatus.ADMIN_CANCELLED);
        reservation.setCancelledAt(timestamp);
        reservation.setCancelledBy(user.id());
        reservation.setAdminNote(request.reason());
        reservation.setUpdatedAt(timestamp);
        reservations.saveAndFlush(reservation);
        return logged(user, reservation, before, LogAction.RESERVATION_CANCEL, request.reason(), now);
    }

    /** 写日志并返回变更后的 Reservation；venue_id 为执行后预约所属场馆（BE-5 C4）。 */
    private ReservationView logged(AuthenticatedUser user, Reservation reservation, ReservationView before,
            LogAction action, String reason, LocalDateTime now) {
        ReservationView after = mapper.toView(reservation, now);
        logWriter.write(new OperationLogWriter.Entry(user.id(), after.venueId(), action, reservation.getId(), reason,
                before, after, List.of(reservation.getId())));
        return after;
    }

    private static LocalDateTime timestamp(LocalDateTime now) {
        return now.truncatedTo(ChronoUnit.MICROS);
    }
}
