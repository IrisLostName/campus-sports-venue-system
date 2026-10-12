package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 预约读取（docs/13 第 3.5 节）。 */
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    /** 一组场地某日状态不在 excluded 中的预约（调用方传入 CANCELLED、ADMIN_CANCELLED 得到有效预约）。 */
    List<Reservation> findByResourceIdInAndServiceDateAndStatusNotIn(Collection<Long> resourceIds,
            LocalDate serviceDate, Collection<ReservationStatus> excluded);
}
