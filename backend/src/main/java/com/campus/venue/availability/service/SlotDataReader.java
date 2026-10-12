package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.availability.repository.AvailabilityRuleRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 时段派生所需数据的读取（BE-2a D4）：每类数据一次查询，查询次数不随场地数或预约数增加（避免 N+1）。
 * 事务由调用方 SlotService 提供。
 */
@Component
public class SlotDataReader {

    /** 不占用时段的预约状态（docs/03 第 4.1 节；与部分唯一索引条件一致）。 */
    static final List<ReservationStatus> INACTIVE =
            List.of(ReservationStatus.CANCELLED, ReservationStatus.ADMIN_CANCELLED);

    private final VenueRepository venues;
    private final ResourceRepository resources;
    private final AvailabilityRuleRepository rules;
    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final AppUserRepository users;

    public SlotDataReader(VenueRepository venues, ResourceRepository resources, AvailabilityRuleRepository rules,
            ReservationRepository reservations, UsageRecordRepository usageRecords, AppUserRepository users) {
        this.venues = venues;
        this.resources = resources;
        this.rules = rules;
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.users = users;
    }

    /** 场馆；不存在 → NOT_FOUND。 */
    Venue requireVenue(long venueId) {
        return venues.findById(venueId).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    /** 场馆的全部场地，按 sortOrder、再按 id 排序。 */
    List<Resource> resourcesOf(long venueId) {
        return resources.findByVenueIdOrderBySortOrderAscIdAsc(venueId);
    }

    /** 场馆在该日期星期（周一 = 1 … 周日 = 7）的 ACTIVE 每周窗口。 */
    List<AvailabilityRule> weeklyFor(long venueId, LocalDate date) {
        return rules.findByVenueIdAndRuleTypeAndStatusAndWeekday(venueId, AvailabilityRuleType.WEEKLY,
                AvailabilityRuleStatus.ACTIVE, (short) date.getDayOfWeek().getValue());
    }

    /** 覆盖该日期的 ACTIVE 特殊关闭（日期范围含两端）。 */
    List<AvailabilityRule> closuresCovering(long venueId, LocalDate date) {
        return rules.findCovering(venueId, AvailabilityRuleType.CLOSURE, AvailabilityRuleStatus.ACTIVE, date);
    }

    /** 这些场地当天的有效预约（状态不是 CANCELLED/ADMIN_CANCELLED）。 */
    List<Reservation> activeReservations(Collection<Long> resourceIds, LocalDate date) {
        if (resourceIds.isEmpty()) {
            return List.of();
        }
        return reservations.findByResourceIdInAndServiceDateAndStatusNotIn(resourceIds, date, INACTIVE);
    }

    /** 预约人 id → 姓名。 */
    Map<Long, String> displayNames(Collection<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(userIds).stream().collect(Collectors.toMap(AppUser::getId, AppUser::getDisplayName));
    }

    /** 预约 id → 使用记录（没有使用记录的预约不在结果中）。 */
    Map<Long, UsageRecord> usageByReservation(Collection<Long> reservationIds) {
        if (reservationIds.isEmpty()) {
            return Map.of();
        }
        return usageRecords.findByReservationIdIn(reservationIds).stream()
                .collect(Collectors.toMap(UsageRecord::getReservationId, Function.identity()));
    }
}
