package com.campus.venue.reservation.service;

import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.validation.ImpactControl;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.dto.ImpactChangeResponse;
import com.campus.venue.reservation.dto.ImpactReport;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.security.AuthenticatedUser;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 影响检查通用机制（docs/12 第 5.5 节“影响检查”六条，BE-2b 裁决 I4–I6）：场馆关闭、场地状态、场地数量、
 * 周开放窗口、特殊关闭五个接口共用，流程与 mock impact.ts 的 applyImpactChange 一致。
 * 只在调用方的事务内运行（MANDATORY）：调用方先锁定场馆行并完成 NOT_FOUND、授权范围与业务校验，再调用 apply；
 * 变更、批量取消与操作日志一起提交或一起回滚。
 */
@Service
public class ImpactChangeService {

    private final AffectedReservationFinder finder;
    private final ReservationRepository reservations;
    private final OperationLogWriter logWriter;
    private final Clock clock;

    public ImpactChangeService(AffectedReservationFinder finder, ReservationRepository reservations,
            OperationLogWriter logWriter, Clock clock) {
        this.finder = finder;
        this.reservations = reservations;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public <T> ImpactChangeResponse<T> apply(AuthenticatedUser admin, ImpactControl control, AffectedScope scope,
            ImpactPlan<T> plan) {
        LocalDateTime now = LocalDateTime.now(clock);
        boolean dryRun = control.dryRunRequested();
        List<Reservation> affected = finder.find(scope, now, !dryRun);
        ImpactReport impact = finder.report(affected);
        // 第 1 条：dryRun 只计算，不写任何数据，也不写日志
        if (dryRun) {
            return new ImpactChangeResponse<>(false, impact, List.of(), null);
        }
        // 第 2 条：存在受影响预约而未给出 onExistingReservations → 409，没有默认值
        if (!affected.isEmpty() && control.onExistingReservations() == null) {
            throw new BusinessException(ErrorCode.IMPACT_CONFIRMATION_REQUIRED, Map.of("impact", impact));
        }
        T data = plan.commit().get();
        // 第 3、4 条：KEEP 预约不动；CANCEL 批量置 ADMIN_CANCELLED
        List<Long> cancelledIds = control.cancelRequested()
                ? cancel(admin, affected, control.reasonOrNull(), now)
                : List.of();
        List<Long> affectedIds = affected.stream().map(Reservation::getId).toList();
        // 第 6 条：写操作日志（前后快照含受影响预约 id）；action 为 null 的变更不写
        if (plan.action() != null) {
            logWriter.write(new OperationLogWriter.Entry(admin.id(), plan.venueId(), plan.action(),
                    plan.targetId().apply(data), control.reasonOrNull(), plan.before(), data, affectedIds));
        }
        return new ImpactChangeResponse<>(true, impact, cancelledIds, data);
    }

    /** cancel_reason 不写（与 mock 一致）；admin_note = 原因；时间取 Clock。 */
    private List<Long> cancel(AuthenticatedUser admin, List<Reservation> affected, String reason,
            LocalDateTime now) {
        LocalDateTime timestamp = now.truncatedTo(ChronoUnit.MICROS);
        for (Reservation reservation : affected) {
            reservation.setStatus(ReservationStatus.ADMIN_CANCELLED);
            reservation.setCancelledAt(timestamp);
            reservation.setUpdatedAt(timestamp);
            reservation.setCancelledBy(admin.id());
            reservation.setAdminNote(reason);
        }
        reservations.saveAllAndFlush(affected);
        return affected.stream().map(Reservation::getId).toList();
    }
}
