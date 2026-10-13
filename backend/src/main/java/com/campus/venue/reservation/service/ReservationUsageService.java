package com.campus.venue.reservation.service;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.security.AuthenticatedUser;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 签到与签退（docs/10 第 4 节，BE-4 I1–I4、O1–O2）。认证、格式、角色 USER 在过滤器与控制器完成；业务顺序与
 * mock 的 checkIn、checkOut（frontend/src/api/mock/reservationService.ts）一致。
 * 只锁预约行、不锁用户行（BE-4 G6：全系统先用户行、后预约行）；状态判断一律用有效状态（BE-4 G7）。
 */
@Service
public class ReservationUsageService {

    /** 使用记录每个预约至多一条的唯一约束（docs/13 第 3.6 节）。 */
    static final String USAGE_RESERVATION_CONSTRAINT = "uq_usage_record_reservation";

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;
    private final ReservationViewMapper mapper;
    private final BookingProperties properties;
    private final Clock clock;

    public ReservationUsageService(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator, ReservationViewMapper mapper, BookingProperties properties,
            Clock clock) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
        this.mapper = mapper;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * 签到（I1–I4）：NOT_FOUND → NOT_OWNER → 有效状态 CONFIRMED（否则 INVALID_STATE）→ 签到窗口闭区间
     * （否则 CHECKIN_WINDOW_CLOSED）→ 尚无使用记录（否则 ALREADY_CHECKED_IN）→ 写入 check_in_at。
     * 未签到且已过窗口关闭时刻的预约有效状态为 NO_SHOW，因此得到 INVALID_STATE 而不是 CHECKIN_WINDOW_CLOSED（I2）。
     */
    @Transactional
    public ReservationView checkIn(AuthenticatedUser user, long id) {
        LocalDateTime now = LocalDateTime.now(clock);
        Reservation reservation = lockOwned(user, id);
        UsageRecord usage = usageRecords.findByReservationId(id).orElse(null);
        requireEffectiveStatus(reservation, usage, now, ReservationStatus.CONFIRMED);
        requireInsideCheckInWindow(reservation, now);
        if (usage != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN);
        }
        insertUsage(id, now);
        return mapper.toView(reservation, now);
    }

    /**
     * 签退（O1–O2）：NOT_FOUND → NOT_OWNER → 有效状态 CONFIRMED 或 COMPLETED（否则 INVALID_STATE）→ 已签到
     * （否则 NOT_CHECKED_IN）→ 未签退（否则 ALREADY_CHECKED_OUT）→ 现在严格早于 结束 + checkOutGraceMinutes
     * （正好等于即拒绝，INVALID_STATE）→ 写入 check_out_at。结束前签退展示为 CHECKED_OUT，结束后为 COMPLETED。
     */
    @Transactional
    public ReservationView checkOut(AuthenticatedUser user, long id) {
        LocalDateTime now = LocalDateTime.now(clock);
        Reservation reservation = lockOwned(user, id);
        UsageRecord usage = usageRecords.findByReservationId(id).orElse(null);
        ReservationStatus effective = requireEffectiveStatus(reservation, usage, now,
                ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED);
        if (usage == null) {
            throw new BusinessException(ErrorCode.NOT_CHECKED_IN);
        }
        if (usage.getCheckOutAt() != null) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_OUT);
        }
        LocalDateTime end = LocalDateTime.of(reservation.getServiceDate(), reservation.getEndTime());
        if (!now.isBefore(end.plusMinutes(properties.checkoutGraceMinutes()))) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", effective.name()));
        }
        usage.setCheckOutAt(now.truncatedTo(ChronoUnit.MICROS));
        usageRecords.saveAndFlush(usage);
        return mapper.toView(reservation, now);
    }

    /** 锁定预约行（SELECT … FOR UPDATE）并确认本人，避免与并发的签到、取消、清扫交错（I3）。 */
    private Reservation lockOwned(AuthenticatedUser user, long id) {
        Reservation reservation = reservations.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (reservation.getUserId() != user.id()) {
            throw new BusinessException(ErrorCode.NOT_OWNER);
        }
        return reservation;
    }

    /** 有效状态须为 allowed 之一，否则 INVALID_STATE（details.status 为有效状态）；返回有效状态。 */
    private ReservationStatus requireEffectiveStatus(Reservation reservation, UsageRecord usage, LocalDateTime now,
            ReservationStatus... allowed) {
        ReservationStatus effective = calculator.effectiveStatus(reservation, usage, now);
        for (ReservationStatus status : allowed) {
            if (status == effective) {
                return effective;
            }
        }
        throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", effective.name()));
    }

    /** 签到窗口为闭区间 [开始 − checkInOpenBefore, 开始 + checkInCloseAfter]，按完整时间戳比较（两端正好都允许）。 */
    private void requireInsideCheckInWindow(Reservation reservation, LocalDateTime now) {
        LocalDateTime start = LocalDateTime.of(reservation.getServiceDate(), reservation.getStartTime());
        LocalDateTime opensAt = start.minusMinutes(properties.checkinOpenBeforeMinutes());
        LocalDateTime closesAt = start.plusMinutes(properties.checkinCloseAfterMinutes());
        if (now.isBefore(opensAt) || now.isAfter(closesAt)) {
            throw new BusinessException(ErrorCode.CHECKIN_WINDOW_CLOSED,
                    Map.of("opensAt", opensAt, "closesAt", closesAt));
        }
    }

    /** 写入使用记录；并发签到撞上 uq_usage_record_reservation（23505）时转换为 ALREADY_CHECKED_IN（I3）。 */
    private void insertUsage(long reservationId, LocalDateTime now) {
        UsageRecord usage = new UsageRecord();
        usage.setReservationId(reservationId);
        usage.setCheckInAt(now.truncatedTo(ChronoUnit.MICROS));
        try {
            usageRecords.saveAndFlush(usage);
        } catch (DataIntegrityViolationException ex) {
            // 只有该约束的唯一冲突才是 ALREADY_CHECKED_IN，其他约束错误原样抛出
            if (UniqueViolations.isViolationOf(ex, USAGE_RESERVATION_CONSTRAINT)) {
                throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN);
            }
            throw ex;
        }
    }
}
