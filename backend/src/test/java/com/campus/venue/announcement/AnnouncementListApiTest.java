package com.campus.venue.announcement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 N1、N2、T3：用户端公告列表与管理端公告列表。 */
class AnnouncementListApiTest extends AnnouncementApiTestBase {

    private MvcResult getAs(long userId, Role role, String url) throws Exception {
        return send(HttpMethod.GET, url, null, userId, role);
    }

    @Test
    @DisplayName("N1 只返回 ACTIVE 且未过期的（过期时刻等于现在也不返回），按发布时间、id 倒序；两种范围互不混入")
    void publicListShowsOnlyLiveAnnouncementsNewestFirst() throws Exception {
        long older = active(null, "旧", NOW.minusDays(2));
        long sameTimeLow = active(null, "同时1", NOW.minusDays(1));
        long sameTimeHigh = active(null, "同时2", NOW.minusDays(1));
        long future = announcement(null, "未过期", "ACTIVE", NOW.minusHours(1), NOW.plusSeconds(1));
        announcement(null, "已归档", "ARCHIVED", NOW.minusHours(1), null);
        announcement(null, "刚过期", "ACTIVE", NOW.minusHours(1), NOW);
        long venueNotice = active(tennis, "网球馆", NOW.minusHours(3));
        announcement(tennis, "网球馆已归档", "ARCHIVED", NOW.minusHours(1), null);
        long badmintonNotice = active(badminton, "羽毛球馆", NOW.minusHours(3));

        assertThat(arrayIds(getAs(zhangsan, Role.USER, PUBLIC + "?scope=SYSTEM")))
                .containsExactly(future, sameTimeHigh, sameTimeLow, older);
        assertThat(arrayIds(getAs(zhangsan, Role.USER, PUBLIC + "?scope=VENUE&venueId=" + tennis)))
                .containsExactly(venueNotice);
        assertThat(arrayIds(getAs(zhangsan, Role.USER, PUBLIC + "?scope=VENUE&venueId=" + badminton)))
                .containsExactly(badmintonNotice);
    }

    @Test
    @DisplayName("08 查看系统公告 / 场馆公告：USER、VENUE_ADMIN、SYS_ADMIN 均可；未登录 401")
    void publicListIsOpenToEveryRoleButNeedsLogin() throws Exception {
        long notice = active(null, "系统", NOW.minusHours(1));

        assertThat(arrayIds(getAs(zhangsan, Role.USER, PUBLIC + "?scope=SYSTEM"))).containsExactly(notice);
        assertThat(arrayIds(getAs(tennisAdmin, Role.VENUE_ADMIN, PUBLIC + "?scope=SYSTEM"))).containsExactly(notice);
        assertThat(arrayIds(getAs(sysAdmin, Role.SYS_ADMIN, PUBLIC + "?scope=SYSTEM"))).containsExactly(notice);
        // VA 查未授权场馆的用户端公告也可以（用户端接口不看授权范围）
        assertThat(arrayIds(getAs(tennisAdmin, Role.VENUE_ADMIN, PUBLIC + "?scope=VENUE&venueId=" + badminton)))
                .isEmpty();
        assertError(mockMvc.perform(get(PUBLIC).param("scope", "SYSTEM")).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    @DisplayName("N1 SYSTEM 时 venueId 被忽略；不存在的场馆得空数组；JSON 字段与 docs/12 一致")
    void systemScopeIgnoresVenueIdAndUnknownVenueIsEmpty() throws Exception {
        long notice = announcement(null, "系统", "ACTIVE", NOW.minusHours(1), NOW.plusDays(1));

        MvcResult result = getAs(zhangsan, Role.USER, PUBLIC + "?scope=SYSTEM&venueId=" + badminton);
        assertThat(arrayIds(result)).containsExactly(notice);
        JsonNode item = json(result).get(0);
        List<String> keys = new ArrayList<>();
        item.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("id", "scope", "venueId", "title", "content", "status", "publishedAt",
                "publishedByName", "expiresAt");
        assertThat(item.get("venueId").isNull()).isTrue();
        assertThat(item.get("publishedByName").asText()).isEqualTo("用户sysadmin");
        assertThat(item.get("publishedAt").asText()).isEqualTo("2026-10-12T07:30:15");
        assertThat(item.get("expiresAt").asText()).isEqualTo("2026-10-13T08:30:15");
        assertThat(arrayIds(getAs(zhangsan, Role.USER, PUBLIC + "?scope=VENUE&venueId=999999"))).isEmpty();
    }

    @Test
    @DisplayName("N1 格式：scope 必填且为两值之一；VENUE 时 venueId 必填正整数；SYSTEM 时给了 venueId 也须为正整数")
    void publicListValidation() throws Exception {
        JsonNode missing = assertError(getAs(zhangsan, Role.USER, PUBLIC), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missing).get("scope").asText()).isEqualTo("必填");

        JsonNode bad = assertError(getAs(zhangsan, Role.USER, PUBLIC + "?scope=ALL&venueId=0"),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(bad).get("scope").asText()).isEqualTo("应为 SYSTEM/VENUE 之一");
        assertThat(fields(bad).get("venueId").asText()).isEqualTo("应为正整数");

        JsonNode noVenue = assertError(getAs(zhangsan, Role.USER, PUBLIC + "?scope=VENUE"), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(noVenue).get("venueId").asText()).isEqualTo("必填");

        JsonNode systemBadVenue = assertError(getAs(zhangsan, Role.USER, PUBLIC + "?scope=SYSTEM&venueId=-1"),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(systemBadVenue).get("venueId").asText()).isEqualTo("应为正整数");

        JsonNode typed = assertError(getAs(zhangsan, Role.USER, PUBLIC + "?scope=VENUE&venueId=abc"),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(typed).get("venueId").asText()).isEqualTo("类型不符");
    }

    @Test
    @DisplayName("N2 VA 可见：授权场馆的场馆公告 + 全部系统公告（含归档、过期），不含其他场馆；SA 全部")
    void adminListVisibility() throws Exception {
        long system = active(null, "系统", NOW.minusDays(3));
        long systemArchived = announcement(null, "系统归档", "ARCHIVED", NOW.minusDays(2), null);
        long tennisExpired = announcement(tennis, "网球馆过期", "ACTIVE", NOW.minusDays(1), NOW.minusHours(1));
        long tennisArchived = announcement(tennis, "网球馆归档", "ARCHIVED", NOW.minusHours(2), null);
        long badmintonNotice = active(badminton, "羽毛球馆", NOW.minusHours(1));

        assertThat(pageIds(getAs(tennisAdmin, Role.VENUE_ADMIN, ADMIN)))
                .containsExactly(tennisArchived, tennisExpired, systemArchived, system);
        assertThat(pageIds(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN)))
                .containsExactly(badmintonNotice, tennisArchived, tennisExpired, systemArchived, system);
        assertThat(pageIds(getAs(tennisAdmin, Role.VENUE_ADMIN, ADMIN + "?scope=SYSTEM&status=ARCHIVED")))
                .containsExactly(systemArchived);
        assertThat(pageIds(getAs(tennisAdmin, Role.VENUE_ADMIN, ADMIN + "?venueId=" + tennis + "&status=ACTIVE")))
                .containsExactly(tennisExpired);
        assertThat(pageIds(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN + "?scope=VENUE")))
                .containsExactly(badmintonNotice, tennisArchived, tennisExpired);
    }

    @Test
    @DisplayName("08 发布场馆公告（范围内）：VA 给了未授权的 venueId → FORBIDDEN_SCOPE；SA 给不存在的场馆得空页")
    void adminListChecksTheGivenVenueFirst() throws Exception {
        active(badminton, "羽毛球馆", NOW.minusHours(1));

        JsonNode error = assertError(getAs(tennisAdmin, Role.VENUE_ADMIN, ADMIN + "?venueId=" + badminton),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(getAs(tennisAdmin, Role.VENUE_ADMIN, ADMIN + "?venueId=999999"), ErrorCode.FORBIDDEN_SCOPE);

        JsonNode empty = json(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN + "?venueId=999999"));
        assertThat(empty.get("items")).isEmpty();
        assertThat(empty.get("total").asLong()).isZero();
    }

    @Test
    @DisplayName("N2 只接受 page，pageSize 固定 20（多传的 pageSize 忽略）；超大页码得空页")
    void adminListUsesAFixedPageSize() throws Exception {
        for (int i = 0; i < 21; i++) {
            active(null, "系统" + i, NOW.minusMinutes(i + 1));
        }

        JsonNode first = json(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN + "?pageSize=5"));
        assertThat(first.get("items")).hasSize(20);
        assertThat(first.get("pageSize").asInt()).isEqualTo(20);
        assertThat(first.get("total").asLong()).isEqualTo(21);
        assertThat(json(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN + "?page=2")).get("items")).hasSize(1);
        JsonNode far = json(getAs(sysAdmin, Role.SYS_ADMIN, ADMIN + "?page=2147483647"));
        assertThat(far.get("items")).isEmpty();
        assertThat(far.get("total").asLong()).isEqualTo(21);
    }

    @Test
    @DisplayName("08 查看/管理公告：USER 调管理端列表 FORBIDDEN；未登录 401；格式先于角色")
    void adminListRoleAndFormatOrder() throws Exception {
        assertError(getAs(zhangsan, Role.USER, ADMIN), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(get(ADMIN)).andReturn(), ErrorCode.AUTH_REQUIRED);

        JsonNode error = assertError(getAs(zhangsan, Role.USER, ADMIN + "?scope=X&status=Y&venueId=0&page=0"),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(error).get("scope").asText()).isEqualTo("应为 SYSTEM/VENUE 之一");
        assertThat(fields(error).get("status").asText()).isEqualTo("应为 ACTIVE/ARCHIVED 之一");
        assertThat(fields(error).get("venueId").asText()).isEqualTo("应为正整数");
        assertThat(fields(error).get("page").asText()).isEqualTo("应为不小于 1 的整数");
    }
}
