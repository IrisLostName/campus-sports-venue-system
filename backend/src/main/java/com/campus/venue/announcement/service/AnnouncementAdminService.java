package com.campus.venue.announcement.service;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.announcement.dto.AnnouncementView;
import com.campus.venue.announcement.dto.CreateAnnouncementRequest;
import com.campus.venue.announcement.repository.AnnouncementRepository;
import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.service.VenueLookup;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 公告发布与归档（docs/12 第 5.8 节，BE-6 N3、N4）。格式与角色（VA、SA）在控制器完成；这里裁决
 * 系统公告的角色限制（FORBIDDEN）、对象不存在（NOT_FOUND）、越权（FORBIDDEN_SCOPE），然后执行并在同一事务写日志。
 */
@Service
public class AnnouncementAdminService {

    private final AnnouncementRepository announcements;
    private final AnnouncementViewMapper mapper;
    private final VenueLookup venueLookup;
    private final VenueScopeGuard venueScopeGuard;
    private final OperationLogWriter logWriter;
    private final Clock clock;

    public AnnouncementAdminService(AnnouncementRepository announcements, AnnouncementViewMapper mapper,
            VenueLookup venueLookup, VenueScopeGuard venueScopeGuard, OperationLogWriter logWriter, Clock clock) {
        this.announcements = announcements;
        this.mapper = mapper;
        this.venueLookup = venueLookup;
        this.venueScopeGuard = venueScopeGuard;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    /**
     * N3：VA 发 SYSTEM → FORBIDDEN；场馆不存在 → NOT_FOUND；越权 → FORBIDDEN_SCOPE。场馆只读存在性、不加锁
     * （计划闸门第 5 条）。写入 ACTIVE、发布者与 Clock 时刻；日志 ANNOUNCEMENT_PUBLISH（before 为 null）。
     */
    @Transactional
    public AnnouncementView publish(AuthenticatedUser user, CreateAnnouncementRequest request) {
        AnnouncementScope scope = AnnouncementScope.valueOf(request.scope());
        if (scope == AnnouncementScope.SYSTEM && user.role() != Role.SYS_ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        Long venueId = null;
        if (scope == AnnouncementScope.VENUE) {
            venueId = venueLookup.require(request.venueId()).getId();
            venueScopeGuard.requireVenueAccess(user, venueId);
        }
        Announcement announcement = new Announcement();
        announcement.setScope(scope);
        announcement.setVenueId(venueId);
        announcement.setTitle(request.title());
        announcement.setContent(request.content());
        announcement.setStatus(AnnouncementStatus.ACTIVE);
        announcement.setPublishedBy(user.id());
        announcement.setPublishedAt(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        announcement.setExpiresAt(request.expiresAt());
        announcements.saveAndFlush(announcement);
        AnnouncementView created = mapper.toView(announcement);
        logWriter.write(new OperationLogWriter.Entry(user.id(), venueId, LogAction.ANNOUNCEMENT_PUBLISH,
                announcement.getId(), null, null, created, List.of()));
        return created;
    }

    /**
     * N4：锁定公告行 → NOT_FOUND → VA 归档系统公告 FORBIDDEN → FORBIDDEN_SCOPE → 置 ARCHIVED，写 ANNOUNCEMENT_ARCHIVE。
     * 已归档的再次归档：状态不变，仍写日志（与 mock 一致，API-SYNC）。
     */
    @Transactional
    public void archive(AuthenticatedUser user, long id) {
        Announcement announcement = announcements.lockById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (announcement.getVenueId() == null && user.role() != Role.SYS_ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        if (announcement.getVenueId() != null) {
            venueScopeGuard.requireVenueAccess(user, announcement.getVenueId());
        }
        AnnouncementView before = mapper.toView(announcement);
        announcement.setStatus(AnnouncementStatus.ARCHIVED);
        announcements.saveAndFlush(announcement);
        AnnouncementView after = mapper.toView(announcement);
        logWriter.write(new OperationLogWriter.Entry(user.id(), announcement.getVenueId(),
                LogAction.ANNOUNCEMENT_ARCHIVE, announcement.getId(), null, before, after, List.of()));
    }
}
