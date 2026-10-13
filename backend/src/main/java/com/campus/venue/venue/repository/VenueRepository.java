package com.campus.venue.venue.repository;

import com.campus.venue.venue.domain.Venue;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 场馆读取、新建与修改（docs/13 第 3.2 节）。 */
public interface VenueRepository extends JpaRepository<Venue, Long> {

    boolean existsByName(String name);

    /** 修改场馆名时：其他场馆是否已用该名称。 */
    boolean existsByNameAndIdNot(String name, Long id);

    Optional<Venue> findByName(String name);

    List<Venue> findAllByOrderByIdAsc();

    List<Venue> findAllByIdInOrderByIdAsc(Collection<Long> ids);

    /** 锁定场馆行（SELECT … FOR UPDATE）：同一场馆的管理变更在此串行化（BE-2b 裁决 G8），锁随事务结束释放。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Venue v where v.id = :id")
    Optional<Venue> lockById(@Param("id") Long id);
}
