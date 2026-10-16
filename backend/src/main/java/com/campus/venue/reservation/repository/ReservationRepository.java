package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 预约读写（docs/13 第 3.5 节）；管理端列表的动态查询见 AdminReservationSearch（BE-5）。 */
public interface ReservationRepository extends JpaRepository<Reservation, Long>, AdminReservationSearch {

    /** 一组场地某日状态不在 excluded 中的预约（调用方传入 CANCELLED、ADMIN_CANCELLED 得到有效预约）。 */
    List<Reservation> findByResourceIdInAndServiceDateAndStatusNotIn(Collection<Long> resourceIds,
            LocalDate serviceDate, Collection<ReservationStatus> excluded);

    /** 第 8 步前置检查：该时段是否已有状态不在 excluded 中的预约。 */
    boolean existsByResourceIdAndServiceDateAndStartTimeAndStatusNotIn(Long resourceId, LocalDate serviceDate,
            LocalTime startTime, Collection<ReservationStatus> excluded);

    /** 资源改派的占用检查（BE-5 A3）：该时段是否已有除 exceptId 之外、状态不在 excluded 中的预约（排除预约自身）。 */
    boolean existsByResourceIdAndServiceDateAndStartTimeAndStatusNotInAndIdNot(Long resourceId,
            LocalDate serviceDate, LocalTime startTime, Collection<ReservationStatus> excluded, Long exceptId);

    /** 取消、签到、签退时锁定预约行（SELECT … FOR UPDATE），避免与并发的取消、签到、清扫交错（BE-3 第 12 节、BE-4 I3）。 */
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

    /**
     * 影响检查的候选（BE-2b 裁决 I3）：这些场地上库中 CONFIRMED、服务日期在 [from, to]、结束时刻晚于现在
     * （today + nowTime）的预约，按 id 升序。是否已越过判定点由调用方用 DisplayStatusCalculator 判断（BE-3 E1）。
     */
    @Query(UNFINISHED_CONFIRMED_IN_RESOURCES)
    List<Reservation> findUnfinishedConfirmed(@Param("resourceIds") Collection<Long> resourceIds,
            @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("today") LocalDate today,
            @Param("nowTime") LocalTime nowTime);

    /** 同 findUnfinishedConfirmed，并按 id 升序锁定（SELECT … FOR UPDATE；与清扫的加锁次序一致，BE-2b 裁决 G8）。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(UNFINISHED_CONFIRMED_IN_RESOURCES)
    List<Reservation> lockUnfinishedConfirmed(@Param("resourceIds") Collection<Long> resourceIds,
            @Param("from") LocalDate from, @Param("to") LocalDate to, @Param("today") LocalDate today,
            @Param("nowTime") LocalTime nowTime);

    String UNFINISHED_CONFIRMED_IN_RESOURCES = "select r from Reservation r"
            + " where r.status = com.campus.venue.reservation.domain.ReservationStatus.CONFIRMED"
            + " and r.resourceId in :resourceIds and r.serviceDate >= :from and r.serviceDate <= :to"
            + " and (r.serviceDate > :today or (r.serviceDate = :today and r.endTime > :nowTime))"
            + " order by r.id asc";

    /** 本页查询不计数，总数由 countByUserId 给出（DatabasePaging）。 */
    List<Reservation> findByUserId(Long userId, Pageable pageable);

    long countByUserId(Long userId);

    List<Reservation> findByUserIdAndIdNotIn(Long userId, Collection<Long> excludedIds, Pageable pageable);

    long countByUserIdAndIdNotIn(Long userId, Collection<Long> excludedIds);

    /**
     * 清扫候选（BE-4 W2）：库中 CONFIRMED 且已开始（服务日期早于 today，或等于 today 且开始时间不晚于 nowTime）、
     * id 大于 afterId 的预约，按 id 升序取一批并锁定（SELECT … FOR UPDATE），与签到、取消的行锁互斥。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Reservation r where r.status = com.campus.venue.reservation.domain.ReservationStatus.CONFIRMED"
            + " and r.id > :afterId"
            + " and (r.serviceDate < :today or (r.serviceDate = :today and r.startTime <= :nowTime))"
            + " order by r.id asc")
    List<Reservation> lockStartedConfirmed(@Param("afterId") long afterId, @Param("today") LocalDate today,
            @Param("nowTime") LocalTime nowTime, Pageable batch);

    /**
     * 清扫落库（BE-4 W1、W2）：把 ids 中库里仍为 CONFIRMED 的预约置为 target、updated_at 置为 at；
     * 已被别处改掉（取消、已落库）的不再覆盖。返回实际更新的行数。
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Reservation r set r.status = :target, r.updatedAt = :at where r.id in :ids"
            + " and r.status = com.campus.venue.reservation.domain.ReservationStatus.CONFIRMED")
    int settleIfConfirmed(@Param("ids") Collection<Long> ids, @Param("target") ReservationStatus target,
            @Param("at") LocalDateTime at);
}
