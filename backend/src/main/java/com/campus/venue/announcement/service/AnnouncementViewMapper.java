package com.campus.venue.announcement.service;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.announcement.dto.AnnouncementView;
import com.campus.venue.user.service.DisplayNames;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Announcement → AnnouncementView；发布者姓名批量装载（一次查询，列表无 N+1）。 */
@Component
public class AnnouncementViewMapper {

    private final DisplayNames displayNames;

    public AnnouncementViewMapper(DisplayNames displayNames) {
        this.displayNames = displayNames;
    }

    public List<AnnouncementView> toViews(List<Announcement> announcements) {
        Map<Long, String> names = displayNames.of(announcements.stream().map(Announcement::getPublishedBy).toList());
        return announcements.stream().map(announcement -> view(announcement, names)).toList();
    }

    public AnnouncementView toView(Announcement announcement) {
        return toViews(List.of(announcement)).get(0);
    }

    private static AnnouncementView view(Announcement a, Map<Long, String> names) {
        return new AnnouncementView(a.getId(), a.getScope(), a.getVenueId(), a.getTitle(), a.getContent(),
                a.getStatus(), a.getPublishedAt(), names.get(a.getPublishedBy()), a.getExpiresAt());
    }
}
