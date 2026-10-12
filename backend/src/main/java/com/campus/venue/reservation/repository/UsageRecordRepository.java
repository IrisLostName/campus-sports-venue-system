package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.UsageRecord;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 使用记录读取（docs/13 第 3.6 节）。 */
public interface UsageRecordRepository extends JpaRepository<UsageRecord, Long> {

    List<UsageRecord> findByReservationIdIn(Collection<Long> reservationIds);
}
