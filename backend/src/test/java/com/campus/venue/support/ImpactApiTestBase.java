package com.campus.venue.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * BE-2b 管理变更接口测试的公共数据与工具。时钟为 2026-10-12（周一）08:30:15。
 * 网球馆（admin_tennis 授权）有网球场1…4（OPEN）、每天 08:00–20:00；羽毛球馆（admin_tennis 无授权）有羽毛球场1。
 * 预约、使用记录直接写库；断言数据与操作日志直接查库。
 */
public abstract class ImpactApiTestBase extends AbstractApiTest {

    protected static final LocalDate TODAY = MutableClock.START.toLocalDate();
    protected static final LocalDate TOMORROW = TODAY.plusDays(1);
    protected static final LocalDateTime NOW = MutableClock.START.withNano(0);

    protected VenueFixtures fixtures;
    protected long sysAdmin;
    protected long tennisAdmin;
    protected long zhangsan;
    protected long lisi;
    protected long tennis;
    protected long badminton;
    protected long court1;
    protected long court2;
    protected long court3;
    protected long court4;
    protected long badmintonCourt;

    @BeforeEach
    void seedVenues() {
        fixtures = new VenueFixtures(jdbc);
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        zhangsan = user("zhangsan", Role.USER);
        lisi = user("lisi", Role.USER);
        tennis = fixtures.bookableVenue("网球馆");
        badminton = fixtures.venue("羽毛球馆", false, "OPEN");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        court1 = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        court2 = fixtures.resource(tennis, "网球场2", 2, "OPEN");
        court3 = fixtures.resource(tennis, "网球场3", 3, "OPEN");
        court4 = fixtures.resource(tennis, "网球场4", 4, "OPEN");
        badmintonCourt = fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
        fixtures.weeklyEveryDay(badminton, "08:00", "20:00");
    }

    // ---- 请求 ----

    protected MvcResult send(HttpMethod method, String url, Object body, long userId, Role role, Object... vars)
            throws Exception {
        MockHttpServletRequestBuilder builder = request(method, url, vars)
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(builder).andReturn();
    }

    protected MvcResult asSys(HttpMethod method, String url, Object body, Object... vars) throws Exception {
        return send(method, url, body, sysAdmin, Role.SYS_ADMIN, vars);
    }

    protected MvcResult asTennisAdmin(HttpMethod method, String url, Object body, Object... vars) throws Exception {
        return send(method, url, body, tennisAdmin, Role.VENUE_ADMIN, vars);
    }

    /** 由键值对组成请求体（保持顺序，允许 null 值）。 */
    protected static Map<String, Object> body(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put((String) pairs[i], pairs[i + 1]);
        }
        return map;
    }

    protected static Map<String, Object> merge(Map<String, Object> first, Map<String, Object> second) {
        Map<String, Object> map = new LinkedHashMap<>(first);
        map.putAll(second);
        return map;
    }

    // ---- 数据 ----

    protected long reservation(long userId, long resourceId, LocalDate date, String start) {
        return fixtures.reservation(userId, resourceId, date, start, "CONFIRMED");
    }

    protected String reservationStatus(long reservationId) {
        return jdbc.queryForObject("select status from reservation where id = ?", String.class, reservationId);
    }

    protected Map<String, Object> reservationRow(long reservationId) {
        return jdbc.queryForMap("select * from reservation where id = ?", reservationId);
    }

    protected String resourceStatus(long resourceId) {
        return jdbc.queryForObject("select operational_status from resource where id = ?", String.class, resourceId);
    }

    protected int logCount() {
        return jdbc.queryForObject("select count(*) from admin_operation_log", Integer.class);
    }

    protected List<Map<String, Object>> logs() {
        return jdbc.queryForList("select * from admin_operation_log order by id");
    }

    /** 唯一的一条日志；快照列转为 JsonNode 便于断言。 */
    protected Map<String, Object> onlyLog() {
        List<Map<String, Object>> rows = logs();
        if (rows.size() != 1) {
            throw new AssertionError("应恰有 1 条日志，实际 " + rows.size());
        }
        return rows.get(0);
    }

    protected JsonNode snapshot(Map<String, Object> log, String column) throws Exception {
        Object value = log.get(column);
        return value == null ? null : objectMapper.readTree(value.toString());
    }

    /** 影响报告中各预约的 id（保持顺序）。 */
    protected static List<Long> briefIds(JsonNode impact) {
        List<Long> list = new ArrayList<>();
        impact.get("reservations").forEach(brief -> list.add(brief.get("id").asLong()));
        return list;
    }

    protected static List<Long> ids(JsonNode array) {
        List<Long> list = new ArrayList<>();
        array.forEach(node -> list.add(node.asLong()));
        return list;
    }
}
