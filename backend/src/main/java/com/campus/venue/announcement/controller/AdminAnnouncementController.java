package com.campus.venue.announcement.controller;

import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.announcement.dto.AdminAnnouncementsQuery;
import com.campus.venue.announcement.dto.AnnouncementView;
import com.campus.venue.announcement.dto.CreateAnnouncementRequest;
import com.campus.venue.announcement.service.AnnouncementAdminService;
import com.campus.venue.announcement.service.AnnouncementQueryService;
import com.campus.venue.announcement.service.AnnouncementQueryService.AdminQuery;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端公告（docs/12 第 5.8 节，BE-6 N2–N4）。角色用方法级注解，使查询参数与请求体校验先于角色检查（BE-6 C1）；
 * 对象是否存在、系统公告的角色限制与授权范围在 service 中裁决。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/announcements")
public class AdminAnnouncementController {

    private final AnnouncementQueryService queryService;
    private final AnnouncementAdminService adminService;

    public AdminAnnouncementController(AnnouncementQueryService queryService, AnnouncementAdminService adminService) {
        this.queryService = queryService;
        this.adminService = adminService;
    }

    /** N2：返回 Page&lt;Announcement&gt;（含 ARCHIVED）；每页固定 20 条。 */
    @GetMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public PageView<AnnouncementView> list(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid AdminAnnouncementsQuery query) {
        AnnouncementScope scope = query.scope() == null ? null : AnnouncementScope.valueOf(query.scope());
        AnnouncementStatus status = query.status() == null ? null : AnnouncementStatus.valueOf(query.status());
        return queryService.listForAdmin(user, new AdminQuery(scope, query.venueId(), status, query.pageOrDefault()));
    }

    /** N3：返回 201 Announcement。 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public AnnouncementView publish(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateAnnouncementRequest request) {
        return adminService.publish(user, request);
    }

    /** N4：归档，返回 204。 */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public void archive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable long id) {
        adminService.archive(user, id);
    }
}
