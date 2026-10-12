package com.campus.venue.venue.repository;

import com.campus.venue.venue.domain.Venue;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 场馆读取与新建（docs/13 第 3.2 节）。 */
public interface VenueRepository extends JpaRepository<Venue, Long> {

    boolean existsByName(String name);

    List<Venue> findAllByOrderByIdAsc();

    List<Venue> findAllByIdInOrderByIdAsc(Collection<Long> ids);
}
