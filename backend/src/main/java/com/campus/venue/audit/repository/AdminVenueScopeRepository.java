package com.campus.venue.audit.repository;

import com.campus.venue.audit.domain.AdminVenueScope;
import com.campus.venue.audit.domain.VenueScopeStatus;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 授权范围读取（docs/13 第 3.9 节）。当前有效 = 状态为 ACTIVE 且 today 在 [valid_from, valid_to] 内，空端视为无限。
 * 调用方传入 ACTIVE 与按 Clock 计算的 today；每次查库，不缓存。
 */
public interface AdminVenueScopeRepository extends JpaRepository<AdminVenueScope, Long> {

    @Query("select count(s) > 0 from AdminVenueScope s where s.adminId = :adminId and s.venueId = :venueId"
            + " and s.status = :status and (s.validFrom is null or s.validFrom <= :today)"
            + " and (s.validTo is null or s.validTo >= :today)")
    boolean existsEffectiveScope(@Param("adminId") long adminId, @Param("venueId") long venueId,
            @Param("status") VenueScopeStatus status, @Param("today") LocalDate today);

    @Query("select s.venueId from AdminVenueScope s where s.adminId = :adminId"
            + " and s.status = :status and (s.validFrom is null or s.validFrom <= :today)"
            + " and (s.validTo is null or s.validTo >= :today) order by s.venueId asc")
    List<Long> findEffectiveVenueIds(@Param("adminId") long adminId, @Param("status") VenueScopeStatus status,
            @Param("today") LocalDate today);
}
