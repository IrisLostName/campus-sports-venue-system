package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.dto.CreateReservationRequest;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.service.ReservationCreationChecks.Target;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 创建预约（docs/10 第 1 节，BE-3 C2–C4）。认证、格式、角色在过滤器与控制器完成；这里按顺序执行第 2–9 步。
 * 先来先得的最终保证是部分唯一索引 uq_reservation_active_slot：并发插入撞索引时转换为 SLOT_TAKEN。
 */
@Service
public class ReservationService {

    /** 有效预约的部分唯一索引（docs/13 第 3.5 节）。 */
    static final String ACTIVE_SLOT_CONSTRAINT = "uq_reservation_active_slot";

    private final ReservationRepository reservations;
    private final AppUserRepository users;
    private final ReservationCreationChecks checks;
    private final ReservationViewMapper mapper;
    private final Clock clock;

    public ReservationService(ReservationRepository reservations, AppUserRepository users,
            ReservationCreationChecks checks, ReservationViewMapper mapper, Clock clock) {
        this.reservations = reservations;
        this.users = users;
        this.checks = checks;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** 第 2–9 步；“现在”每个请求只取一次 Clock。 */
    @Transactional
    public ReservationView create(AuthenticatedUser user, CreateReservationRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate date = request.serviceDate();
        LocalTime start = request.startTime();
        Target target = checks.bookableTarget(request.resourceId());
        checks.resourceOpen(target.resource());
        checks.dateInRange(date, now.toLocalDate());
        checks.derivedSlot(target, date, start);
        checks.notPast(date, start, now);
        // C4：先锁定该用户的 app_user 行再计数，同一用户的并发创建在此串行化，持有上限不会被突破
        users.lockById(user.id());
        checks.underLimit(user.id(), now);
        checks.slotFree(target.resource().getId(), date, start);
        Reservation reservation = insert(user.id(), request, now);
        return mapper.toView(reservation, now);
    }

    /** 第 9 步：status = CONFIRMED，end_time = start + 90 分钟，user_id 取自令牌，时间戳取 Clock。 */
    private Reservation insert(long userId, CreateReservationRequest request, LocalDateTime now) {
        LocalDateTime timestamp = now.truncatedTo(ChronoUnit.MICROS);
        Reservation reservation = new Reservation();
        reservation.setUserId(userId);
        reservation.setResourceId(request.resourceId());
        reservation.setServiceDate(request.serviceDate());
        reservation.setStartTime(request.startTime());
        reservation.setEndTime(request.startTime().plusMinutes(BookingRulesService.SLOT_MINUTES));
        reservation.setStatus(ReservationStatus.CONFIRMED);
        reservation.setPurpose(blankToNull(request.purpose()));
        reservation.setCreatedAt(timestamp);
        reservation.setUpdatedAt(timestamp);
        try {
            return reservations.saveAndFlush(reservation);
        } catch (DataIntegrityViolationException ex) {
            // C3：只有该索引的唯一冲突（23505）才是 SLOT_TAKEN，其他约束错误原样抛出
            if (UniqueViolations.isViolationOf(ex, ACTIVE_SLOT_CONSTRAINT)) {
                throw new BusinessException(ErrorCode.SLOT_TAKEN);
            }
            throw ex;
        }
    }

    /** 空白视为未填（与 BE-1 phone、BE-2a location 一致）；非空白按原值保存。 */
    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
