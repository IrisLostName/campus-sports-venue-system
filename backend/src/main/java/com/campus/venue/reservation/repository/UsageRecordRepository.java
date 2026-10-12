package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.UsageRecord;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;

/** 使用记录读取（docs/13 第 3.6 节）。 */
public interface UsageRecordRepository extends JpaRepository<UsageRecord, Long> {

    List<UsageRecord> findByReservationIdIn(Collection<Long> reservationIds);

    Optional<UsageRecord> findByReservationId(Long reservationId);

    /** 预约 id → 使用记录（没有使用记录的预约不在结果中）；一次查询。 */
    default Map<Long, UsageRecord> mapByReservationId(Collection<Long> reservationIds) {
        if (reservationIds.isEmpty()) {
            return Map.of();
        }
        return findByReservationIdIn(reservationIds).stream()
                .collect(Collectors.toMap(UsageRecord::getReservationId, Function.identity()));
    }
}
