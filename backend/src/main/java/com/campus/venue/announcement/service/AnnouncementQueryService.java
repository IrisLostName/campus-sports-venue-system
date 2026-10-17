package com.campus.venue.announcement.service;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.announcement.dto.AnnouncementView;
import com.campus.venue.announcement.repository.AnnouncementRepository;
import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.common.repository.SpecificationPages;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 公告查询（docs/12 第 5.2、5.8 节，BE-6 N1、N2），与 mock contentService.ts 的 listAnnouncements、
 * adminListAnnouncements 一致。
 */
@Service
public class AnnouncementQueryService {

    /** 管理端列表固定每页 20 条（BE-6 C2）。 */
    static final int ADMIN_PAGE_SIZE = 20;
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "publishedAt", "id");

    private final AnnouncementRepository announcements;
    private final SpecificationPages pages;
    private final AnnouncementViewMapper mapper;
    private final VenueScopeGuard venueScopeGuard;
    private final Clock clock;

    public AnnouncementQueryService(AnnouncementRepository announcements, SpecificationPages pages,
            AnnouncementViewMapper mapper, VenueScopeGuard venueScopeGuard, Clock clock) {
        this.announcements = announcements;
        this.pages = pages;
        this.mapper = mapper;
        this.venueScopeGuard = venueScopeGuard;
        this.clock = clock;
    }

    /** 管理端列表的过滤条件（已通过格式校验，均可为 null）。 */
    public record AdminQuery(AnnouncementScope scope, Long venueId, AnnouncementStatus status, int page) {
    }

    /** N1：该范围内 ACTIVE 且未过期的公告（不分页）。scope=SYSTEM 时 venueId 被忽略；场馆不存在 → 空数组。 */
    @Transactional(readOnly = true)
    public List<AnnouncementView> listLive(AnnouncementScope scope, Long venueId) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Announcement> live = scope == AnnouncementScope.SYSTEM
                ? announcements.findLiveByScope(scope, AnnouncementStatus.ACTIVE, now)
                : announcements.findLiveByScopeAndVenue(scope, venueId, AnnouncementStatus.ACTIVE, now);
        return mapper.toViews(live);
    }

    /**
     * N2：含 ARCHIVED 与已过期。给了 venueId 先做授权检查（FORBIDDEN_SCOPE；SA 传不存在的场馆得空页）。
     * 可见集合：SA 全部；VA 为全部系统公告 + 当前有效授权场馆的场馆公告（授权为空时只有系统公告，不生成 IN ()）。
     */
    @Transactional(readOnly = true)
    public PageView<AnnouncementView> listForAdmin(AuthenticatedUser user, AdminQuery query) {
        if (query.venueId() != null) {
            venueScopeGuard.requireVenueAccess(user, query.venueId());
        }
        List<Long> visibleVenueIds = user.role() == Role.SYS_ADMIN ? null
                : venueScopeGuard.effectiveVenueIds(user.id());
        Specification<Announcement> spec = adminSpec(query, visibleVenueIds);
        return DatabasePaging.page(query.page(), ADMIN_PAGE_SIZE, NEWEST_FIRST,
                () -> announcements.count(spec),
                request -> pages.find(Announcement.class, spec, request),
                mapper::toViews);
    }

    /** visibleVenueIds 为 null 表示不限（SA）。 */
    private static Specification<Announcement> adminSpec(AdminQuery query, List<Long> visibleVenueIds) {
        return (root, criteria, cb) -> {
            List<Predicate> list = new ArrayList<>();
            if (visibleVenueIds != null) {
                list.add(visibleVenueIds.isEmpty() ? cb.isNull(root.get("venueId"))
                        : cb.or(cb.isNull(root.get("venueId")), root.get("venueId").in(visibleVenueIds)));
            }
            if (query.scope() != null) {
                list.add(cb.equal(root.get("scope"), query.scope()));
            }
            if (query.venueId() != null) {
                list.add(cb.equal(root.get("venueId"), query.venueId()));
            }
            if (query.status() != null) {
                list.add(cb.equal(root.get("status"), query.status()));
            }
            return cb.and(list.toArray(Predicate[]::new));
        };
    }
}
