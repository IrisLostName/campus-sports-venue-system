package com.campus.venue.audit.repository;

import com.campus.venue.audit.domain.AdminVenueScope;
import com.campus.venue.audit.domain.VenueScopeStatus;
import java.time.LocalDate;
import java.util.Collection;
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

    /** 多个管理员当前有效的授权（BE-6 U1 批量装载 venueIds，一次查询），按管理员、场馆 id 升序。 */
    @Query("select s from AdminVenueScope s where s.adminId in :adminIds"
            + " and s.status = :status and (s.validFrom is null or s.validFrom <= :today)"
            + " and (s.validTo is null or s.validTo >= :today) order by s.adminId asc, s.venueId asc")
    List<AdminVenueScope> findEffectiveScopes(@Param("adminIds") Collection<Long> adminIds,
            @Param("status") VenueScopeStatus status, @Param("today") LocalDate today);

    /** 某管理员的全部授权行（任意状态，BE-6 U4 整体替换用）。 */
    List<AdminVenueScope> findByAdminId(Long adminId);
}
