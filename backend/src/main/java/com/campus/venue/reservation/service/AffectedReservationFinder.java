package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.ImpactReport;
import com.campus.venue.reservation.dto.ReservationBrief;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.repository.ResourceRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 受影响预约的查找（BE-2b 裁决 I3、I5）：有效状态（BE-3 E1）为 CONFIRMED 且结束时刻晚于现在、落在变更范围内的预约，
 * 按 id 升序。已签到、尚未结束的预约同样算（与 mock impact.ts 的 futureConfirmed 一致）。
 * 候选、使用记录、场地名、预约人姓名各一次查询，查询次数不随预约数增加。事务由调用方提供。
 */
@Component
public class AffectedReservationFinder {

    /** “不限”的日期上界（PostgreSQL date 能表示的普通日期）。 */
    private static final LocalDate DATE_MAX = LocalDate.of(9999, 12, 31);

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final ResourceRepository resources;
    private final AppUserRepository users;
    private final DisplayStatusCalculator calculator;

    public AffectedReservationFinder(ReservationRepository reservations, UsageRecordRepository usageRecords,
            ResourceRepository resources, AppUserRepository users, DisplayStatusCalculator calculator) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.resources = resources;
        this.users = users;
        this.calculator = calculator;
    }

    /** lock 为 true 时按 id 升序锁定候选预约行（非 dryRun 的执行，BE-2b 裁决第 9 节第 6 条）。 */
    public List<Reservation> find(AffectedScope scope, LocalDateTime now, boolean lock) {
        if (scope.resourceIds().isEmpty()) {
            return List.of();
        }
        LocalDate today = now.toLocalDate();
        LocalDate from = scope.from() == null || scope.from().isBefore(today) ? today : scope.from();
        LocalDate to = scope.to() == null ? DATE_MAX : scope.to();
        if (to.isBefore(from)) {
            return List.of();
        }
        List<Reservation> candidates = lock
                ? reservations.lockUnfinishedConfirmed(scope.resourceIds(), from, to, today, now.toLocalTime())
                : reservations.findUnfinishedConfirmed(scope.resourceIds(), from, to, today, now.toLocalTime());
        List<Reservation> inScope = candidates.stream().filter(scope.extra()).toList();
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(inScope.stream().map(Reservation::getId)
                .toList());
        return inScope.stream()
                .filter(reservation -> calculator.effectiveStatus(reservation, usage.get(reservation.getId()), now)
                        == ReservationStatus.CONFIRMED)
                .toList();
    }

    /** 影响报告：保持传入顺序（id 升序）。 */
    public ImpactReport report(List<Reservation> affected) {
        if (affected.isEmpty()) {
            return new ImpactReport(0, List.of());
        }
        Map<Long, String> resourceNames = resources.findAllById(affected.stream().map(Reservation::getResourceId)
                .distinct().toList()).stream().collect(Collectors.toMap(Resource::getId, Resource::getName));
        Map<Long, AppUser> people = users.findAllById(affected.stream().map(Reservation::getUserId).distinct()
                .toList()).stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
        List<ReservationBrief> briefs = affected.stream()
                .map(reservation -> new ReservationBrief(reservation.getId(),
                        resourceNames.get(reservation.getResourceId()), reservation.getServiceDate(),
                        reservation.getStartTime(), reservation.getEndTime(),
                        people.get(reservation.getUserId()).getDisplayName()))
                .toList();
        return new ImpactReport(briefs.size(), briefs);
    }
}
