package com.campus.venue.reservation.service;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.CancelReservationRequest;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.security.AuthenticatedUser;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户取消预约（docs/10 第 3 节，BE-3 X1、X2）。认证、格式、角色 USER 在过滤器与控制器完成；这里依次：
 * NOT_FOUND → 本人 NOT_OWNER → 有效状态 CONFIRMED（否则 INVALID_STATE，details.status 为有效状态）→ 无签到记录
 * ALREADY_CHECKED_IN → 距开始 ≥ cancelDeadlineMinutes（正好等于允许，否则 CANCEL_DEADLINE_PASSED）。
 * 与 mock 的 cancelReservation（frontend/src/api/mock/reservationService.ts）一致。
 */
@Service
public class ReservationCancelService {

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;
    private final ReservationViewMapper mapper;
    private final BookingProperties properties;
    private final Clock clock;

    public ReservationCancelService(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator, ReservationViewMapper mapper, BookingProperties properties,
            Clock clock) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
        this.mapper = mapper;
        this.properties = properties;
        this.clock = clock;
    }

    /** request 可为 null（请求体缺省）。成功后时段随即可被再次预约（部分唯一索引不再包含该记录）。 */
    @Transactional
    public ReservationView cancel(AuthenticatedUser user, long id, CancelReservationRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        // 锁定预约行，避免与并发的取消、签到交错（BE-3 裁决第 12 节第 4 条）
        Reservation reservation = reservations.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (reservation.getUserId() != user.id()) {
            throw new BusinessException(ErrorCode.NOT_OWNER);
        }
        UsageRecord usage = usageRecords.findByReservationId(id).orElse(null);
        ReservationStatus effective = calculator.effectiveStatus(reservation, usage, now);
        if (effective != ReservationStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", effective.name()));
        }
        if (usage != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN);
        }
        requireBeforeDeadline(reservation, now);
        LocalDateTime timestamp = now.truncatedTo(ChronoUnit.MICROS);
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setCancelledAt(timestamp);
        reservation.setUpdatedAt(timestamp);
        reservation.setCancelledBy(user.id());
        reservation.setCancelReason(ReservationService.blankToNull(request == null ? null : request.reason()));
        reservations.saveAndFlush(reservation);
        return mapper.toView(reservation, now);
    }

    /** 距开始 ≥ cancelDeadlineMinutes 才可取消（正好等于允许）。 */
    private void requireBeforeDeadline(Reservation reservation, LocalDateTime now) {
        LocalDateTime start = LocalDateTime.of(reservation.getServiceDate(), reservation.getStartTime());
        if (now.plusMinutes(properties.cancelDeadlineMinutes()).isAfter(start)) {
            throw new BusinessException(ErrorCode.CANCEL_DEADLINE_PASSED,
                    Map.of("cancelDeadlineMinutes", properties.cancelDeadlineMinutes()));
        }
    }
}
