package com.campus.venue.announcement.dto;

import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import java.time.LocalDateTime;

/** 公告（docs/12 第 4 节 Announcement）：系统公告 venueId 为 null；publishedByName 为发布者姓名。 */
public record AnnouncementView(
        long id,
        AnnouncementScope scope,
        Long venueId,
        String title,
        String content,
        AnnouncementStatus status,
        LocalDateTime publishedAt,
        String publishedByName,
        LocalDateTime expiresAt) {
}
