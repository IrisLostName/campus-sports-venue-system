package com.campus.venue.stats.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.stats.repository.ReservationStatsRepository;
import com.campus.venue.stats.repository.ReservationStatsRepository.StatusCount;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.repository.ResourceRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 统计所需数据的读取（BE-7 S1、S2、S3、S8、S9）：每类数据一条语句，次数不随区间天数、场地数或预约数增加；
 * 空集合不发查询。开放日历（S4、S5）由 SlotDataReader 读取，越过判定点的候选（S6、S7）由 OverdueReservations 读取。
 * 事务由调用方提供。
 */
@Component
public class StatsDataReader {

    /** 不占用时段的预约状态（docs/03 第 4.1 节，与部分唯一索引的条件一致）。 */
    static final Set<ReservationStatus> CANCELLED =
            EnumSet.of(ReservationStatus.CANCELLED, ReservationStatus.ADMIN_CANCELLED);

    private final ResourceRepository resources;
    private final ReservationStatsRepository stats;
    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;

    public StatsDataReader(ResourceRepository resources, ReservationStatsRepository stats,
            ReservationRepository reservations, UsageRecordRepository usageRecords) {
        this.resources = resources;
        this.stats = stats;
        this.reservations = reservations;
        this.usageRecords = usageRecords;
    }

    /** S1：这些场馆的全部场地（含 DISABLED），按场馆 id、sortOrder、id 升序。venueIds 非空。 */
    List<Resource> resourcesOf(Collection<Long> venueIds) {
        return resources.findByVenueIdInOrderByVenueIdAscSortOrderAscIdAsc(venueIds);
    }

    /** S2（K1）：创建日期在区间内，即 created_at ∈ [from 00:00, to 的次日 00:00)。venueIds 非空。 */
    List<StatusCount> createdCounts(Collection<Long> venueIds, StatsPeriod period) {
        return stats.countByCreatedDate(venueIds, period.from().atStartOfDay(),
                period.to().plusDays(1).atStartOfDay());
    }

    /** S3（K2、K6 的库中状态）：服务日期在区间内。venueIds 非空。 */
    List<StatusCount> serviceCounts(Collection<Long> venueIds, StatsPeriod period) {
        return stats.countByServiceDate(venueIds, period.from(), period.to());
    }

    /** S8（K5、D4）：这些场地当天的有效预约（复用 BE-2a 时段派生的查询）。 */
    List<Reservation> activeOn(Collection<Long> resourceIds, LocalDate date) {
        if (resourceIds.isEmpty()) {
            return List.of();
        }
        return reservations.findByResourceIdInAndServiceDateAndStatusNotIn(resourceIds, date, CANCELLED);
    }

    /** S9：预约 id → 使用记录（没有使用记录的预约不在结果中）。 */
    Map<Long, UsageRecord> usageOf(Collection<Long> reservationIds) {
        return usageRecords.mapByReservationId(reservationIds);
    }
}
