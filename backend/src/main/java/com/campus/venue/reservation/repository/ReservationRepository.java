package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 预约读写（docs/13 第 3.5 节）。 */
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    /** 一组场地某日状态不在 excluded 中的预约（调用方传入 CANCELLED、ADMIN_CANCELLED 得到有效预约）。 */
    List<Reservation> findByResourceIdInAndServiceDateAndStatusNotIn(Collection<Long> resourceIds,
            LocalDate serviceDate, Collection<ReservationStatus> excluded);

    /** 第 8 步前置检查：该时段是否已有状态不在 excluded 中的预约。 */
    boolean existsByResourceIdAndServiceDateAndStartTimeAndStatusNotIn(Long resourceId, LocalDate serviceDate,
            LocalTime startTime, Collection<ReservationStatus> excluded);

    /** 取消时锁定预约行（SELECT … FOR UPDATE），避免与并发的取消、签到交错（BE-3 裁决第 12 节第 4 条）。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.id = :id")
    Optional<Reservation> findByIdForUpdate(@Param("id") Long id);

    /**
     * 用户库中状态为 status 且结束时刻晚于现在（today + nowTime）的预约，按服务日期、开始时间、id 升序。
     * 只按“未结束”筛选；是否已越过判定点由调用方用 DisplayStatusCalculator 判断（BE-3 E1）。
     */
    @Query("select r from Reservation r where r.userId = :userId and r.status = :status"
            + " and (r.serviceDate > :today or (r.serviceDate = :today and r.endTime > :nowTime))"
            + " order by r.serviceDate asc, r.startTime asc, r.id asc")
    List<Reservation> findUnfinished(@Param("userId") Long userId, @Param("status") ReservationStatus status,
            @Param("today") LocalDate today, @Param("nowTime") LocalTime nowTime);

    Page<Reservation> findByUserId(Long userId, Pageable pageable);

    Page<Reservation> findByUserIdAndIdNotIn(Long userId, Collection<Long> excludedIds, Pageable pageable);
}
