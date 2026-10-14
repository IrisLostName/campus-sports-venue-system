package com.campus.venue.venue.repository;

import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 场地读写（docs/13 第 3.3 节）。 */
public interface ResourceRepository extends JpaRepository<Resource, Long> {

    /** 某场馆的全部场地，按 sortOrder、再按 id 排序（与 mock resourcesOfVenue 一致）。 */
    List<Resource> findByVenueIdOrderBySortOrderAscIdAsc(Long venueId);

    /** 场地所属场馆的 id（只取这一列，不把场地实体放进持久化上下文；BE-2b 先据此锁定场馆行，再读取场地）。 */
    @Query("select r.venueId from Resource r where r.id = :id")
    Optional<Long> findVenueIdById(@Param("id") Long id);

    /** 修改场地名时：同一场馆内其他场地是否已用该名称。 */
    boolean existsByVenueIdAndNameAndIdNot(Long venueId, String name, Long id);

    /** 某场馆中状态不是 excluded 的场地数。 */
    long countByVenueIdAndOperationalStatusNot(Long venueId, ResourceStatus excluded);

    /** 各场馆中状态不是 excluded 的场地数，一次查询（避免逐场馆查询）。 */
    @Query("select r.venueId as venueId, count(r) as total from Resource r"
            + " where r.operationalStatus <> :excluded group by r.venueId")
    List<VenueResourceCount> countByVenueExcludingStatus(@Param("excluded") ResourceStatus excluded);

    /** 分组计数的投影。 */
    interface VenueResourceCount {
        Long getVenueId();

        long getTotal();
    }
}
