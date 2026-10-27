package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.CheckInCode;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 签发签到码（docs/12 第 5.3 节 GET /reservations/{id}/check-in-code，P2-1b）。认证、格式、角色 USER 在过滤器与控制器
 * 完成；这里依次：NOT_FOUND → NOT_OWNER → 有效状态 CONFIRMED（否则 INVALID_STATE，details.status 为有效状态）→
 * 尚无使用记录（否则 ALREADY_CHECKED_IN）。不检查签到窗口：窗口开始前即可出示，是否在窗口内由扫码时裁决
 * （P2-1b 裁决第 6 节第 3 条）。“已结束”由有效状态覆盖：已结束的 CONFIRMED 预约有效状态必为 NO_SHOW 或 COMPLETED。
 * 只读，不加锁。
 */
@Service
public class CheckInCodeService {

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final AppUserRepository users;
    private final DisplayStatusCalculator calculator;
    private final Clock clock;

    public CheckInCodeService(ReservationRepository reservations, UsageRecordRepository usageRecords,
            AppUserRepository users, DisplayStatusCalculator calculator, Clock clock) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.users = users;
        this.calculator = calculator;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CheckInCode issue(AuthenticatedUser user, long id) {
        LocalDateTime now = LocalDateTime.now(clock);
        Reservation reservation = reservations.findById(id)
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
        // 本人即预约人，用户行受外键保护、该列非空，所以总能取到；防御性地按不存在处理
        UUID checkInUuid = users.findCheckInUuidById(user.id())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        return new CheckInCode(CheckInCodes.format(checkInUuid, id));
    }
}
