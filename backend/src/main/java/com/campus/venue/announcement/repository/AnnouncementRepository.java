package com.campus.venue.announcement.repository;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 公告读写（docs/13 第 3.7 节）。管理端列表的动态条件见 AnnouncementQueryService（Specification）。 */
public interface AnnouncementRepository extends JpaRepository<Announcement, Long>,
        JpaSpecificationExecutor<Announcement> {

    /** 某范围中给定状态、未过期（expiresAt 为空或晚于 now）的公告，按发布时间、id 倒序。 */
    @Query("select a from Announcement a where a.scope = :scope and a.status = :status"
            + " and (a.expiresAt is null or a.expiresAt > :now) order by a.publishedAt desc, a.id desc")
    List<Announcement> findLiveByScope(@Param("scope") AnnouncementScope scope,
            @Param("status") AnnouncementStatus status, @Param("now") LocalDateTime now);

    /** 某场馆的场馆公告中给定状态、未过期的，按发布时间、id 倒序。 */
    @Query("select a from Announcement a where a.scope = :scope and a.venueId = :venueId and a.status = :status"
            + " and (a.expiresAt is null or a.expiresAt > :now) order by a.publishedAt desc, a.id desc")
    List<Announcement> findLiveByScopeAndVenue(@Param("scope") AnnouncementScope scope,
            @Param("venueId") long venueId, @Param("status") AnnouncementStatus status,
            @Param("now") LocalDateTime now);

    /** 锁定公告行（SELECT … FOR UPDATE）：同一公告的归档串行（BE-6 N4）。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Announcement a where a.id = :id")
    Optional<Announcement> lockById(@Param("id") Long id);
}
