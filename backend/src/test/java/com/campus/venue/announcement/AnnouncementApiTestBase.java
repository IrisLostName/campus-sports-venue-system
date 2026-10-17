package com.campus.venue.announcement;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-6 公告接口测试的公共工具。数据沿用 ImpactApiTestBase：时钟 2026-10-12 08:30:15；admin_tennis 只授权网球馆。
 * 公告直接写库造数据；断言直接查库。
 */
public abstract class AnnouncementApiTestBase extends ImpactApiTestBase {

    protected static final String PUBLIC = "/api/v1/announcements";
    protected static final String ADMIN = "/api/v1/admin/announcements";
    protected static final String ARCHIVE = "/api/v1/admin/announcements/{id}";

    /** 直接写库的公告；venueId 为 null 即系统公告。 */
    protected long announcement(Long venueId, String title, String status, LocalDateTime publishedAt,
            LocalDateTime expiresAt) {
        return jdbc.queryForObject("insert into announcement (scope, venue_id, title, content, status, published_by,"
                + " published_at, expires_at) values (?, ?, ?, '内容', ?, ?, ?, ?) returning id", Long.class,
                venueId == null ? "SYSTEM" : "VENUE", venueId, title, status, sysAdmin, Timestamp.valueOf(publishedAt),
                expiresAt == null ? null : Timestamp.valueOf(expiresAt));
    }

    protected long active(Long venueId, String title, LocalDateTime publishedAt) {
        return announcement(venueId, title, "ACTIVE", publishedAt, null);
    }

    protected String announcementStatus(long id) {
        return jdbc.queryForObject("select status from announcement where id = ?", String.class, id);
    }

    /** 200 数组响应中各元素的 id（保持顺序）。 */
    protected List<Long> arrayIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    /** 200 分页响应中 items 的 id（保持顺序）。 */
    protected List<Long> pageIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).get("items").forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    protected JsonNode fields(JsonNode error) {
        return error.get("details").get("fields");
    }
}
