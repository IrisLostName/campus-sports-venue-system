package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.MutableClock;
import com.campus.venue.support.TokenForgery;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-7 T7 大屏接口：无令牌、无效与过期令牌均 200（D1）；generatedAt 与空库的形状（D2）；无个人信息且键集合恰为
 * DisplaySummary（D7，以演示种子数据的用户为样本）；公告只含有效系统公告且至多 5 条（D6）；weekTrend 7 天（D5）；
 * 与 SA 今天的总览口径一致（第 2 节）。
 */
class DisplaySummaryApiTest extends StatsTestBase {

    private static final List<String> TOP_KEYS = List.of("generatedAt", "todayReservationCount", "currentInUse",
            "todayUtilizationRate", "venues", "resources", "weekTrend", "notices");

    @Autowired
    private DataSource dataSource;

    /** 公告的发布人（D6 用例中创建）。 */
    private long publisher;

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    @Test
    @DisplayName("D1：无令牌、过期、伪造、无签名、乱码、错误方案的 Authorization 头都照常 200")
    void authorizationHeaderIsIgnored() throws Exception {
        long id = user("zhangsan", Role.USER);
        String expired = bearer(id, Role.USER);
        Instant now = clock.instant();
        clock.setLocal(MutableClock.START.plusHours(9));
        List<String> authorizations = new ArrayList<>(List.of(expired,
                "Bearer " + TokenForgery.signedWithOtherSecret(id, now, now.plusSeconds(3600)),
                "Bearer " + TokenForgery.unsigned(id, now.plusSeconds(3600)),
                "Bearer not-a-jwt", "Basic abc"));
        authorizations.add(null);

        for (String authorization : authorizations) {
            MvcResult result = summary(authorization);
            assertThat(result.getResponse().getStatus()).as(String.valueOf(authorization)).isEqualTo(200);
            assertThat(json(result).get("generatedAt").asText()).isEqualTo("2026-10-12T17:30:15");
        }
    }

    @Test
    @DisplayName("D2：没有场馆时数字为 0、今天利用率为 null（键存在）、weekTrend 仍为 7 天")
    void emptyDatabaseShape() throws Exception {
        JsonNode body = summaryOk();

        assertThat(keys(body)).containsExactlyElementsOf(TOP_KEYS);
        assertThat(body.get("generatedAt").asText()).isEqualTo("2026-10-12T08:30:15");
        assertThat(body.get("todayReservationCount").asLong()).isZero();
        assertThat(body.get("currentInUse").asLong()).isZero();
        assertThat(body.get("todayUtilizationRate").isNull()).isTrue();
        assertThat(body.get("venues")).isEmpty();
        assertThat(body.get("resources")).isEmpty();
        assertThat(body.get("weekTrend")).hasSize(7);
        assertThat(body.get("notices")).isEmpty();
    }

    private long seedUser(String username) {
        return jdbc.queryForObject("select id from app_user where username = ?", Long.class, username);
    }

    private long seedResource(String name) {
        return jdbc.queryForObject("select id from resource where name = ?", Long.class, name);
    }

    /**
     * 演示种子数据（db/demo/V100__demo_seed.sql）上再造今天的使用中、待使用与取消的预约，并补上电话、用途、取消原因、
     * 管理员备注，作为个人信息的样本。
     */
    private List<String> seedWithPersonalData() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/demo/V100__demo_seed.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
        jdbc.update("update app_user set phone = '13912345678' where username = 'zhangsan'");
        long inUse = fixtures.reservation(seedUser("zhangsan"), seedResource("网球场1"), TODAY, "08:00", "CONFIRMED");
        fixtures.usage(inUse, TODAY.atTime(7, 55), null);
        long upcoming = fixtures.reservation(seedUser("lisi"), seedResource("网球场2"), TODAY, "09:30", "CONFIRMED");
        long cancelled = fixtures.reservation(seedUser("wangwu"), seedResource("泳道1"), TODAY, "09:00", "CANCELLED");
        long moved = fixtures.reservation(seedUser("zhaoliu"), seedResource("网球场3"), TODAY, "08:00",
                "ADMIN_CANCELLED");
        jdbc.update("update reservation set purpose = '张三训练专用' where id = ?", inUse);
        jdbc.update("update reservation set purpose = '李四约球' where id = ?", upcoming);
        jdbc.update("update reservation set cancel_reason = '王五临时有事' where id = ?", cancelled);
        jdbc.update("update reservation set admin_note = '赵六改到明天' where id = ?", moved);
        return List.of("zhangsan", "lisi", "wangwu", "zhaoliu", "admin_tennis", "admin_pool", "sysadmin",
                "张三", "李四", "王五", "赵六", "网球馆管理员", "游泳羽毛球馆管理员", "系统管理员",
                "13912345678", "张三训练专用", "李四约球", "王五临时有事", "赵六改到明天");
    }

    @Test
    @DisplayName("D7：响应中没有任何种子用户的用户名、姓名、电话或预约内容；各层键集合恰为 docs/12 的 DisplaySummary")
    void noPersonalInformation() throws Exception {
        List<String> samples = seedWithPersonalData();

        MvcResult result = summary(null);
        String text = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode body = json(result);

        for (String sample : samples) {
            assertThat(text).as(sample).doesNotContain(sample);
        }
        assertThat(keys(body)).containsExactlyElementsOf(TOP_KEYS);
        assertThat(body.get("venues")).hasSize(3);
        for (JsonNode venue : body.get("venues")) {
            assertThat(keys(venue)).containsExactly("venueId", "venueName", "operationalStatus",
                    "userBookingEnabled", "resourceTotal", "resourceOpen", "resourcesReservedNow");
        }
        assertThat(body.get("resources")).hasSize(16);
        for (JsonNode resource : body.get("resources")) {
            assertThat(keys(resource)).containsExactly("venueId", "resourceId", "resourceName", "state");
        }
        assertThat(body.get("resources").findValuesAsText("state")).containsOnly("IN_USE", "RESERVED", "FREE");
        assertThat(body.get("venues").get(0).get("resourcesReservedNow").asLong()).isEqualTo(2);
        assertThat(body.get("notices").findValuesAsText("title")).containsExactly("欢迎使用校园场馆预约系统");
        assertThat(body.get("currentInUse").asLong()).isEqualTo(1);
    }

    private long announcement(String scope, Long venueId, String title, String status,
            LocalDateTime publishedAt, LocalDateTime expiresAt) {
        return jdbc.queryForObject("insert into announcement (scope, venue_id, title, content, status, published_by,"
                + " published_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?) returning id", Long.class, scope,
                venueId, title, title, status, publisher, Timestamp.valueOf(publishedAt),
                expiresAt == null ? null : Timestamp.valueOf(expiresAt));
    }

    @Test
    @DisplayName("D6：只含 ACTIVE 且未过期的系统公告，按发布时间、id 倒序取前 5 条，只有 id 与标题")
    void noticesAreTheFiveNewestLiveSystemAnnouncements() throws Exception {
        publisher = user("sysadmin", Role.SYS_ADMIN);
        long venue = fixtures.bookableVenue("网球馆");
        LocalDateTime now = MutableClock.START;
        List<Long> expected = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            long id = announcement("SYSTEM", null, "系统" + i, "ACTIVE", now.minusDays(i), null);
            if (i <= 4) {
                expected.add(id);
            }
        }
        long sameTime = announcement("SYSTEM", null, "同刻", "ACTIVE", now.minusDays(4), now.plusDays(1));
        expected.add(3, sameTime);
        announcement("SYSTEM", null, "已归档", "ARCHIVED", now, null);
        announcement("SYSTEM", null, "已过期", "ACTIVE", now, now.minusSeconds(1));
        announcement("SYSTEM", null, "此刻过期", "ACTIVE", now, now);
        announcement("VENUE", venue, "场馆公告", "ACTIVE", now, null);

        JsonNode notices = summaryOk().get("notices");

        assertThat(notices).hasSize(5);
        assertThat(notices.findValuesAsText("id")).containsExactlyElementsOf(
                expected.stream().limit(5).map(String::valueOf).toList());
        for (JsonNode notice : notices) {
            assertThat(keys(notice)).containsExactly("id", "title");
        }
    }

    @Test
    @DisplayName("D5：weekTrend 为今天往前 6 天到今天共 7 项（升序），按创建日期计数")
    void weekTrendCoversSevenDays() throws Exception {
        long venue = fixtures.bookableVenue("网球馆");
        long court = fixtures.resource(venue, "1号", 1, "OPEN");
        long owner = user("owner", Role.USER);
        reservation(owner, court, TODAY.plusDays(1), "08:00", "CONFIRMED", TODAY.minusDays(7).atTime(23, 59, 59));
        reservation(owner, court, TODAY.plusDays(1), "09:30", "CONFIRMED", TODAY.minusDays(6).atStartOfDay());
        reservation(owner, court, TODAY.plusDays(1), "11:00", "CANCELLED", TODAY.minusDays(2).atTime(12, 0));
        reservation(owner, court, TODAY.plusDays(1), "11:00", "CONFIRMED", TODAY.atTime(8, 0));

        JsonNode trend = summaryOk().get("weekTrend");

        assertThat(trend.findValuesAsText("date")).containsExactly(TODAY.minusDays(6).toString(),
                TODAY.minusDays(5).toString(), TODAY.minusDays(4).toString(), TODAY.minusDays(3).toString(),
                TODAY.minusDays(2).toString(), TODAY.minusDays(1).toString(), TODAY.toString());
        assertThat(trend.findValuesAsText("reservationCount")).containsExactly("1", "0", "0", "0", "1", "0", "1");
        for (JsonNode point : trend) {
            assertThat(keys(point)).containsExactly("date", "reservationCount");
        }
    }

    @Test
    @DisplayName("口径一致：同一时刻 SA 以今天为区间的总览与大屏的今日预约量、今日利用率、当前使用相等")
    void displayMatchesTheOverviewForToday() throws Exception {
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        long owner = user("owner", Role.USER);
        long tennis = fixtures.bookableVenue("网球馆");
        long court1 = fixtures.resource(tennis, "1号", 1, "OPEN");
        long court2 = fixtures.resource(tennis, "2号", 2, "MAINTENANCE");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
        long pool = fixtures.venue("游泳馆", false, "OPEN");
        long lane1 = fixtures.resource(pool, "1道", 1, "OPEN");
        fixtures.resource(pool, "2道", 2, "OPEN");
        fixtures.weeklyEveryDay(pool, "09:00", "21:00");
        fixtures.closure(pool, lane1, TODAY, TODAY);
        fixtures.usage(reservation(owner, court1, TODAY, "08:00", "CONFIRMED"), TODAY.atTime(7, 58), null);
        reservation(owner, court2, TODAY, "09:30", "CONFIRMED");
        reservation(owner, lane1, TODAY, "09:00", "CANCELLED");
        reservation(owner, lane1, TODAY.plusDays(2), "09:00", "CONFIRMED", TODAY.minusDays(1).atTime(9, 0));

        JsonNode display = summaryOk();
        JsonNode overview = overviewOk(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.toString(),
                "dateTo", TODAY.toString());

        assertThat(display.get("todayReservationCount").asLong()).isEqualTo(3)
                .isEqualTo(overview.get("reservationCount").asLong());
        assertThat(display.get("currentInUse").asLong()).isEqualTo(1)
                .isEqualTo(overview.get("currentInUse").asLong());
        assertThat(display.get("todayUtilizationRate").asDouble()).isEqualTo(2.0 / 16)
                .isEqualTo(overview.get("utilizationRate").asDouble());
    }
}
