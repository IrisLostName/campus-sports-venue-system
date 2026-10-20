package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * TEST-1 S2 权限：docs/08 第 2 节能力矩阵中 ContentAndUserPermissionMatrixTest 未覆盖的各行 × 四种身份（未登录、USER、
 * VENUE_ADMIN、SYS_ADMIN），每行至少一例。admin_tennis 只授权网球馆（id 1）；羽毛球馆（id 2）上的对象用于越权
 * FORBIDDEN_SCOPE 与 SA 全局。期望为状态码（成功）或错误码；成功只断言状态码（业务结果由各接口的测试负责）。
 * 路径与请求体中的占位符：:mine（zhangsan 在网球馆的预约）、:other（lisi 在网球馆的预约）、:bad（lisi 在羽毛球馆的预约）、
 * :badClosure（羽毛球馆的关闭规则）、:court1、:badCourt（场地 id）、:zhangsan（用户 id）。
 */
class BookingAndVenuePermissionMatrixTest extends ImpactApiTestBase {

    private static final String ANON = "ANON";
    private static final String DAY = TOMORROW.toString();
    private static final String LATER = TOMORROW.plusDays(4).toString();
    private static final String REASON = "{\"reason\":\"调整\"}";

    private long mine;
    private long other;
    private long bad;
    private long badClosure;

    @BeforeEach
    void seedObjects() {
        mine = reservation(zhangsan, court1, TOMORROW, "09:30");
        other = reservation(lisi, court2, TOMORROW, "09:30");
        bad = reservation(lisi, badmintonCourt, TOMORROW, "09:30");
        badClosure = fixtures.closure(badminton, null, TOMORROW.plusDays(5), TOMORROW.plusDays(5));
    }

    private static Arguments row(String capability, String method, String path, String body, String role,
            String expected) {
        return Arguments.of(capability + " | " + method + " " + path + " as " + role, method, path, body, role,
                expected);
    }

    /** 同一请求的四种身份：未登录一律 AUTH_REQUIRED；expected 依次为 USER、VENUE_ADMIN、SYS_ADMIN 的期望。 */
    private static List<Arguments> four(String capability, String method, String path, String body,
            String... expected) {
        return List.of(row(capability, method, path, body, ANON, "AUTH_REQUIRED"),
                row(capability, method, path, body, "USER", expected[0]),
                row(capability, method, path, body, "VENUE_ADMIN", expected[1]),
                row(capability, method, path, body, "SYS_ADMIN", expected[2]));
    }

    private static List<Arguments> concat(List<List<Arguments>> groups) {
        List<Arguments> all = new ArrayList<>();
        groups.forEach(all::addAll);
        return all;
    }

    /** 查看用户端开放的场馆、场地、时段；创建预约；查看/取消自己的预约、签到、签退。 */
    static List<Arguments> userSideRows() {
        String browse = "查看用户端开放的场馆、场地、时段";
        String create = "创建预约";
        String own = "查看/取消自己的预约、签到、签退";
        String booking = "{\"resourceId\"::court1,\"serviceDate\":\"" + DAY + "\",\"startTime\":\"11:00\"}";
        return concat(List.of(
                four(browse, "GET", "/api/v1/venues", null, "200", "200", "200"),
                four(browse, "GET", "/api/v1/venues/1/slots?date=" + DAY, null, "200", "200", "200"),
                four(create, "POST", "/api/v1/reservations", booking, "201", "FORBIDDEN", "FORBIDDEN"),
                four(own, "GET", "/api/v1/reservations/me", null, "200", "FORBIDDEN", "FORBIDDEN"),
                four(own, "POST", "/api/v1/reservations/:mine/cancel", null, "200", "FORBIDDEN", "FORBIDDEN"),
                four(own, "POST", "/api/v1/reservations/:mine/check-in", null, "CHECKIN_WINDOW_CLOSED", "FORBIDDEN",
                        "FORBIDDEN"),
                four(own, "POST", "/api/v1/reservations/:mine/check-out", null, "NOT_CHECKED_IN", "FORBIDDEN",
                        "FORBIDDEN")));
    }

    /** 查看预约明细（含预约人）：USER 仅自己的、VA 范围内、SA 全局；场地占用总览。 */
    static List<Arguments> detailRows() {
        String detail = "查看预约明细（含预约人）";
        String occupancy = "场地占用总览";
        return concat(List.of(
                four(detail, "GET", "/api/v1/reservations/:bad", null, "NOT_OWNER", "FORBIDDEN_SCOPE", "200"),
                List.of(row(detail, "GET", "/api/v1/reservations/:mine", null, "USER", "200"),
                        row(detail, "GET", "/api/v1/reservations/:other", null, "VENUE_ADMIN", "200"),
                        row(detail, "GET", "/api/v1/admin/reservations", null, "VENUE_ADMIN", "200")),
                four(detail, "GET", "/api/v1/admin/reservations?venueId=2", null, "FORBIDDEN", "FORBIDDEN_SCOPE",
                        "200"),
                four(occupancy, "GET", "/api/v1/admin/venues/2/occupancy?date=" + DAY, null, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                List.of(row(occupancy, "GET", "/api/v1/admin/venues/1/occupancy?date=" + DAY, null, "VENUE_ADMIN",
                        "200"))));
    }

    /** 管理员取消预约、改派（资源/人员）。 */
    static List<Arguments> overrideRows() {
        String override = "管理员取消预约、改派（资源/人员）";
        String toCourt = "{\"resourceId\"::badCourt,\"serviceDate\":\"" + DAY + "\",\"startTime\":\"11:00\","
                + "\"reason\":\"调整\"}";
        String toUser = "{\"userId\"::zhangsan,\"reason\":\"调整\"}";
        return concat(List.of(
                four(override, "POST", "/api/v1/admin/reservations/:bad/cancel", REASON, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                List.of(row(override, "POST", "/api/v1/admin/reservations/:other/cancel", REASON, "VENUE_ADMIN",
                        "200")),
                four(override, "POST", "/api/v1/admin/reservations/:bad/reassign-resource", toCourt, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                four(override, "POST", "/api/v1/admin/reservations/:bad/reassign-user", toUser, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200")));
    }

    /** 设定场地数量、新增/改名/维护/停用场地；调整开放窗口、新增特殊关闭。 */
    static List<Arguments> resourceAndRuleRows() {
        String resources = "设定场地数量、新增/改名/维护/停用场地";
        String rules = "调整开放窗口、新增特殊关闭";
        String windows = IntStream.rangeClosed(1, 7)
                .mapToObj(day -> "{\"weekday\":" + day + ",\"openTime\":\"08:00\",\"closeTime\":\"20:00\"}")
                .collect(Collectors.joining(",", "{\"windows\":[", "]}"));
        String closure = "{\"startDate\":\"" + LATER + "\",\"endDate\":\"" + LATER + "\"}";
        return concat(List.of(
                four(resources, "GET", "/api/v1/admin/venues/2/resources", null, "FORBIDDEN", "FORBIDDEN_SCOPE",
                        "200"),
                four(resources, "PUT", "/api/v1/admin/venues/2/resource-count", "{\"count\":1}", "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                four(resources, "PATCH", "/api/v1/admin/resources/:badCourt", "{\"name\":\"羽毛球场A\"}",
                        "FORBIDDEN", "FORBIDDEN_SCOPE", "200"),
                List.of(row(resources, "PATCH", "/api/v1/admin/resources/:court1", "{\"name\":\"网球场A\"}",
                        "VENUE_ADMIN", "200")),
                four(rules, "GET", "/api/v1/admin/venues/2/availability-rules", null, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                four(rules, "PUT", "/api/v1/admin/venues/2/availability-rules/weekly", windows, "FORBIDDEN",
                        "FORBIDDEN_SCOPE", "200"),
                four(rules, "POST", "/api/v1/admin/venues/2/closures", closure, "FORBIDDEN", "FORBIDDEN_SCOPE",
                        "201"),
                List.of(row(rules, "POST", "/api/v1/admin/venues/1/closures", closure, "VENUE_ADMIN", "201")),
                four(rules, "DELETE", "/api/v1/admin/closures/:badClosure", null, "FORBIDDEN", "FORBIDDEN_SCOPE",
                        "204")));
    }

    /** 编辑场馆简介；新增场馆、修改名称/类型/位置/状态；user_booking_enabled；发布系统公告；查看统计。 */
    static List<Arguments> venueAndStatsRows() {
        String profile = "编辑场馆简介";
        String venues = "新增场馆、修改场馆名称/类型/位置/operational_status";
        String booking = "打开或关闭 user_booking_enabled";
        String system = "发布系统公告";
        String stats = "查看统计";
        String description = "{\"description\":\"新简介\"}";
        return concat(List.of(
                four(profile, "GET", "/api/v1/admin/venues", null, "FORBIDDEN", "200", "200"),
                four(profile, "PATCH", "/api/v1/admin/venues/2", description, "FORBIDDEN", "FORBIDDEN_SCOPE", "200"),
                List.of(row(profile, "PATCH", "/api/v1/admin/venues/1", description, "VENUE_ADMIN", "200")),
                four(venues, "POST", "/api/v1/admin/venues", "{\"name\":\"新场馆\",\"venueType\":\"TENNIS\"}",
                        "FORBIDDEN", "FORBIDDEN", "201"),
                four(venues, "PATCH", "/api/v1/admin/venues/1", "{\"name\":\"新网球馆\"}", "FORBIDDEN", "FORBIDDEN",
                        "200"),
                four(booking, "PATCH", "/api/v1/admin/venues/1", "{\"userBookingEnabled\":false}", "FORBIDDEN",
                        "FORBIDDEN", "200"),
                four(system, "POST", "/api/v1/admin/announcements",
                        "{\"scope\":\"SYSTEM\",\"title\":\"t\",\"content\":\"c\"}", "FORBIDDEN", "FORBIDDEN", "201"),
                four(stats, "GET", "/api/v1/admin/stats/overview?venueId=2", null, "FORBIDDEN", "FORBIDDEN_SCOPE",
                        "200"),
                List.of(row(stats, "GET", "/api/v1/admin/stats/overview", null, "VENUE_ADMIN", "200"),
                        row(stats, "GET", "/api/v1/display/summary", null, ANON, "200"),
                        row(stats, "GET", "/api/v1/display/summary", null, "USER", "200"))));
    }

    private String resolve(String text) {
        return text.replace(":mine", String.valueOf(mine)).replace(":other", String.valueOf(other))
                .replace(":badClosure", String.valueOf(badClosure)).replace(":badCourt", String.valueOf(badmintonCourt))
                .replace(":bad", String.valueOf(bad)).replace(":court1", String.valueOf(court1))
                .replace(":zhangsan", String.valueOf(zhangsan));
    }

    @ParameterizedTest(name = "{0} → {5}")
    @MethodSource({"userSideRows", "detailRows", "overrideRows", "resourceAndRuleRows", "venueAndStatsRows"})
    void permissionMatrix(String name, String method, String path, String body, String role, String expected)
            throws Exception {
        assertThat(List.of(tennis, badminton)).as("矩阵中的场馆 id：1 网球馆、2 羽毛球馆").containsExactly(1L, 2L);
        MockHttpServletRequestBuilder builder = request(HttpMethod.valueOf(method), resolve(path));
        if (!ANON.equals(role)) {
            Role actor = Role.valueOf(role);
            long userId = switch (actor) {
                case USER -> zhangsan;
                case VENUE_ADMIN -> tennisAdmin;
                case SYS_ADMIN -> sysAdmin;
            };
            builder.header("Authorization", bearer(userId, actor));
        }
        if (body != null) {
            builder.contentType(MediaType.APPLICATION_JSON).content(resolve(body));
        }

        MvcResult result = mockMvc.perform(builder).andReturn();

        if (Character.isDigit(expected.charAt(0))) {
            assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString())
                    .isEqualTo(Integer.parseInt(expected));
        } else {
            assertError(result, ErrorCode.valueOf(expected));
            assertThat(logCount()).as("被拒绝的请求不写日志").isZero();
        }
    }
}
