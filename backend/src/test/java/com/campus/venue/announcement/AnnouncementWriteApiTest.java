package com.campus.venue.announcement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 N3、N4、T3、T7：发布与归档公告（阶段顺序、权限、日志）。 */
class AnnouncementWriteApiTest extends AnnouncementApiTestBase {

    private static Map<String, Object> venueNotice(Object venueId) {
        return body("scope", "VENUE", "venueId", venueId, "title", "暂停开放", "content", "周末维护");
    }

    private static Map<String, Object> systemNotice() {
        return body("scope", "SYSTEM", "title", "系统通知", "content", "系统维护");
    }

    private int announcementCount() {
        return jdbc.queryForObject("select count(*) from announcement", Integer.class);
    }

    @Test
    @DisplayName("08 发布场馆公告（范围内）：VA 在范围内发布 201，字段、库中行与 ANNOUNCEMENT_PUBLISH 日志")
    void venueAdminPublishesAVenueNotice() throws Exception {
        Map<String, Object> request = merge(venueNotice(tennis), body("title", "  原样 标题 ",
                "expiresAt", "2026-10-20T18:00:00"));

        MvcResult result = asTennisAdmin(HttpMethod.POST, ADMIN, request);

        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(201);
        JsonNode created = json(result);
        assertThat(created.get("scope").asText()).isEqualTo("VENUE");
        assertThat(created.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(created.get("title").asText()).isEqualTo("  原样 标题 ");
        assertThat(created.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(created.get("publishedAt").asText()).isEqualTo("2026-10-12T08:30:15");
        assertThat(created.get("publishedByName").asText()).isEqualTo("用户admin_tennis");
        assertThat(created.get("expiresAt").asText()).isEqualTo("2026-10-20T18:00:00");
        long id = created.get("id").asLong();
        Map<String, Object> row = jdbc.queryForMap("select * from announcement where id = ?", id);
        assertThat(row.get("published_by")).isEqualTo(tennisAdmin);

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("ANNOUNCEMENT_PUBLISH");
        assertThat(log.get("target_type")).isEqualTo("ANNOUNCEMENT");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("reason")).isNull();
        assertThat(snapshot(log, "before_snapshot").get("object").isNull()).isTrue();
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(created);
        assertThat(snapshot(log, "after_snapshot").get("affectedReservationIds")).isEmpty();
    }

    @Test
    @DisplayName("08 发布系统公告：SA 可发，日志 venue_id 为空；expiresAt 可为过去时刻（不校验，API-SYNC）")
    void sysAdminPublishesASystemNotice() throws Exception {
        MvcResult result = asSys(HttpMethod.POST, ADMIN, merge(systemNotice(),
                body("expiresAt", "2020-01-01T00:00:00")));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("venueId").isNull()).isTrue();
        Map<String, Object> log = onlyLog();
        assertThat(log.get("venue_id")).isNull();
        assertThat(log.get("action")).isEqualTo("ANNOUNCEMENT_PUBLISH");
        // 已过期的不出现在用户端列表
        assertThat(arrayIds(send(HttpMethod.GET, PUBLIC + "?scope=SYSTEM", null, zhangsan, Role.USER))).isEmpty();
    }

    @Test
    @DisplayName("08 发布系统公告：VA → FORBIDDEN；USER 发任何公告 → FORBIDDEN；均不写入")
    void systemNoticesAreSysAdminOnly() throws Exception {
        assertError(asTennisAdmin(HttpMethod.POST, ADMIN, systemNotice()), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.POST, ADMIN, venueNotice(tennis), zhangsan, Role.USER), ErrorCode.FORBIDDEN);

        assertThat(announcementCount()).isZero();
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("08 发布场馆公告（范围内）：VA 越权 FORBIDDEN_SCOPE；场馆不存在 NOT_FOUND（先于越权）")
    void venueNoticeChecksExistenceThenScope() throws Exception {
        JsonNode error = assertError(asTennisAdmin(HttpMethod.POST, ADMIN, venueNotice(badminton)),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(asTennisAdmin(HttpMethod.POST, ADMIN, venueNotice(999999)), ErrorCode.NOT_FOUND);
        assertError(asSys(HttpMethod.POST, ADMIN, venueNotice(999999)), ErrorCode.NOT_FOUND);

        assertThat(asSys(HttpMethod.POST, ADMIN, venueNotice(badminton)).getResponse().getStatus()).isEqualTo(201);
        assertThat(announcementCount()).isEqualTo(1);
        assertThat(logCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("N3 格式：SYSTEM 带 venueId、VENUE 缺 venueId、标题内容空白与超长、expiresAt 格式；一次收集、先于角色")
    void publishValidation() throws Exception {
        JsonNode system = assertError(send(HttpMethod.POST, ADMIN, merge(systemNotice(), body("venueId", tennis)),
                zhangsan, Role.USER), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(system).get("venueId").asText()).isEqualTo("SYSTEM 公告不应带 venueId");

        JsonNode venue = assertError(asTennisAdmin(HttpMethod.POST, ADMIN, body("scope", "VENUE",
                "title", " ", "content", "内".repeat(2001))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(venue).get("venueId").asText()).isEqualTo("必填");
        assertThat(fields(venue).get("title").asText()).isEqualTo("必填");
        assertThat(fields(venue).get("content").asText()).isEqualTo("不能超过 2000 个字符");

        JsonNode noScope = assertError(asSys(HttpMethod.POST, ADMIN, body("venueId", tennis,
                "title", "标".repeat(101), "content", "内容")), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(noScope).get("scope").asText()).isEqualTo("必填");
        assertThat(fields(noScope).get("venueId").asText()).isEqualTo("SYSTEM 公告不应带 venueId");
        assertThat(fields(noScope).get("title").asText()).isEqualTo("不能超过 100 个字符");

        JsonNode badScope = assertError(asSys(HttpMethod.POST, ADMIN, merge(venueNotice(0),
                body("scope", "venue"))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(badScope).get("scope").asText()).isEqualTo("应为 SYSTEM/VENUE 之一");

        JsonNode zero = assertError(asSys(HttpMethod.POST, ADMIN, venueNotice(0)), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(zero).get("venueId").asText()).isEqualTo("应为正整数");

        JsonNode expires = assertError(asSys(HttpMethod.POST, ADMIN, merge(systemNotice(),
                body("expiresAt", "2026-10-20 18:00"))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(expires).get("expiresAt").asText()).isEqualTo("类型不符");

        assertThat(announcementCount()).isZero();
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("08 发布场馆公告：未登录 401")
    void publishNeedsLogin() throws Exception {
        assertError(mockMvc.perform(post(ADMIN).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(systemNotice()))).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    @DisplayName("08 发布场馆公告（范围内）：VA 归档本场馆公告 204，状态 ARCHIVED，ANNOUNCEMENT_ARCHIVE 前后快照")
    void venueAdminArchivesAVenueNotice() throws Exception {
        long id = active(tennis, "网球馆", NOW.minusHours(1));

        MvcResult result = asTennisAdmin(HttpMethod.DELETE, ARCHIVE, null, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(204);
        assertThat(result.getResponse().getContentAsString()).isEmpty();
        assertThat(announcementStatus(id)).isEqualTo("ARCHIVED");
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("ANNOUNCEMENT_ARCHIVE");
        assertThat(log.get("target_type")).isEqualTo("ANNOUNCEMENT");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(snapshot(log, "before_snapshot").get("object").get("status").asText()).isEqualTo("ACTIVE");
        assertThat(snapshot(log, "after_snapshot").get("object").get("status").asText()).isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("N4 重复归档：204、状态不变、仍写日志（与 mock 一致，API-SYNC）")
    void archivingTwiceStillLogs() throws Exception {
        long id = active(null, "系统", NOW.minusHours(1));

        assertThat(asSys(HttpMethod.DELETE, ARCHIVE, null, id).getResponse().getStatus()).isEqualTo(204);
        assertThat(asSys(HttpMethod.DELETE, ARCHIVE, null, id).getResponse().getStatus()).isEqualTo(204);

        assertThat(announcementStatus(id)).isEqualTo("ARCHIVED");
        List<Map<String, Object>> logs = logs();
        assertThat(logs).hasSize(2).allSatisfy(log -> assertThat(log.get("action")).isEqualTo("ANNOUNCEMENT_ARCHIVE"));
        assertThat(snapshot(logs.get(1), "before_snapshot").get("object").get("status").asText())
                .isEqualTo("ARCHIVED");
    }

    @Test
    @DisplayName("08 发布系统公告：VA 归档系统公告 FORBIDDEN；越权 FORBIDDEN_SCOPE；不存在 NOT_FOUND；USER FORBIDDEN")
    void archiveChecks() throws Exception {
        long system = active(null, "系统", NOW.minusHours(1));
        long other = active(badminton, "羽毛球馆", NOW.minusHours(1));

        assertError(asTennisAdmin(HttpMethod.DELETE, ARCHIVE, null, system), ErrorCode.FORBIDDEN);
        JsonNode scope = assertError(asTennisAdmin(HttpMethod.DELETE, ARCHIVE, null, other),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(scope.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(asTennisAdmin(HttpMethod.DELETE, ARCHIVE, null, 999999), ErrorCode.NOT_FOUND);
        assertError(send(HttpMethod.DELETE, ARCHIVE, null, zhangsan, Role.USER, system), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(delete(ARCHIVE, system)).andReturn(), ErrorCode.AUTH_REQUIRED);

        assertThat(announcementStatus(system)).isEqualTo("ACTIVE");
        assertThat(announcementStatus(other)).isEqualTo("ACTIVE");
        assertThat(logCount()).isZero();
    }
}
