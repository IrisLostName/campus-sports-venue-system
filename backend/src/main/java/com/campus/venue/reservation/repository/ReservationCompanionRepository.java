package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.ReservationCompanion;
import com.campus.venue.reservation.domain.ReservationCompanionId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;

/** 同行人名单读写（docs/13 第 3.6a 节，P2-2b）。人员改派时的移除见 ReservationRepository.removeCompanion。 */
public interface ReservationCompanionRepository extends JpaRepository<ReservationCompanion, ReservationCompanionId> {

    List<ReservationCompanion> findByReservationIdInOrderByReservationIdAscPositionAsc(Collection<Long> reservationIds);

    /** 预约 id → 按 position 排好的名单（没有同行人的预约不在结果中）；一次查询。 */
    default Map<Long, List<ReservationCompanion>> mapByReservationId(Collection<Long> reservationIds) {
        if (reservationIds.isEmpty()) {
            return Map.of();
        }
        return findByReservationIdInOrderByReservationIdAscPositionAsc(reservationIds).stream()
                .collect(Collectors.groupingBy(ReservationCompanion::getReservationId));
    }
}
