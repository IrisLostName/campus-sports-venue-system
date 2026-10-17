package com.campus.venue.announcement.controller;

import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.dto.AnnouncementQuery;
import com.campus.venue.announcement.dto.AnnouncementView;
import com.campus.venue.announcement.service.AnnouncementQueryService;
import com.campus.venue.common.ApiPaths;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 用户端公告（docs/12 第 5.2 节，BE-6 N1）：已登录的任意角色。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/announcements")
public class AnnouncementController {

    private final AnnouncementQueryService queryService;

    public AnnouncementController(AnnouncementQueryService queryService) {
        this.queryService = queryService;
    }

    /** 返回 Announcement[]：该范围内 ACTIVE 且未过期，按发布时间倒序。 */
    @GetMapping
    public List<AnnouncementView> list(@Valid AnnouncementQuery query) {
        return queryService.listLive(AnnouncementScope.valueOf(query.scope()), query.venueId());
    }
}
