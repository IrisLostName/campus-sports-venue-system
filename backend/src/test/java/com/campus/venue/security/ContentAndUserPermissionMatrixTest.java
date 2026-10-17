package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * BE-6 T2（P6）：13 个接口的权限矩阵（docs/08 第 2 节能力行写在用例名中）。每个接口：未登录 401；角色不符 FORBIDDEN
 * （USER 调管理端、VA 调 SA 专属、VA/SA 调 /repairs）；带场馆的接口（公告管理、报修管理、日志）VA 越权 FORBIDDEN_SCOPE；
 * 格式先于角色至少一例；GET /announcements 三种角色均可访问。
 * 路径中的 :announcement、:repair 为羽毛球馆（admin_tennis 未授权）的公告、报修，:user 为 zhangsan。
 */
class ContentAndUserPermissionMatrixTest extends ImpactApiTestBase {

    private static final Object NONE = null;
    private static final String ANON = "ANON";

    private long badmintonAnnouncement;
    private long badmintonRepair;

    @BeforeEach
    void seedVenueBoundObjects() {
        badmintonAnnouncement = jdbc.queryForObject("insert into announcement (scope, venue_id, title, content,"
                + " published_by, published_at) values ('VENUE', ?, '标题', '内容', ?, ?) returning id", Long.class,
                badminton, sysAdmin, Timestamp.valueOf(NOW));
        badmintonRepair = jdbc.queryForObject("insert into repair_report (venue_id, reporter_id, description,"
                + " created_at, updated_at) values (?, ?, '坏了', ?, ?) returning id", Long.class, badminton, zhangsan,
                Timestamp.valueOf(NOW), Timestamp.valueOf(NOW));
    }

    private static Arguments row(String capability, String method, String path, Object body, String role,
            String expected) {
        return Arguments.of(capability + " | " + method + " " + path + " as " + role, method, path, body, role,
                expected);
    }

    private static final Map<String, Object> VENUE_NOTICE = Map.of("scope", "VENUE", "venueId", 2, "title", "t",
            "content", "c");
    private static final Map<String, Object> REPAIR = Map.of("venueId", 1, "description", "坏了");
    private static final Map<String, Object> PROGRESS = Map.of("status", "IN_PROGRESS");
    private static final Map<String, Object> ACCOUNT = Map.of("username", "new_one", "password", "Passw0rd!",
            "displayName", "名", "role", "USER");
    private static final Map<String, Object> DISABLE = Map.of("status", "DISABLED");
    private static final Map<String, Object> SCOPE = Map.of("venueIds", List.of());

    /** 查看系统公告 / 场馆公告；发布场馆公告（范围内）。 */
    static List<Arguments> announcementRows() {
        String notices = "查看系统公告 / 场馆公告";
        String publish = "发布场馆公告（范围内）";
        String admin = "/api/v1/admin/announcements";
        String one = admin + "/:announcement";
        return List.of(
                row(notices, "GET", "/api/v1/announcements?scope=SYSTEM", NONE, ANON, "AUTH_REQUIRED"),
                row(notices, "GET", "/api/v1/announcements?scope=SYSTEM", NONE, "USER", "200"),
                row(notices, "GET", "/api/v1/announcements?scope=VENUE&venueId=2", NONE, "VENUE_ADMIN", "200"),
                row(notices, "GET", "/api/v1/announcements?scope=SYSTEM", NONE, "SYS_ADMIN", "200"),
                row(notices, "GET", "/api/v1/announcements", NONE, "USER", "VALIDATION_ERROR"),
                row(publish, "GET", admin, NONE, ANON, "AUTH_REQUIRED"),
                row(publish, "GET", admin, NONE, "USER", "FORBIDDEN"),
                row(publish, "GET", admin + "?venueId=2", NONE, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(publish, "GET", admin + "?status=X", NONE, "USER", "VALIDATION_ERROR"),
                row(publish, "POST", admin, VENUE_NOTICE, ANON, "AUTH_REQUIRED"),
                row(publish, "POST", admin, VENUE_NOTICE, "USER", "FORBIDDEN"),
                row(publish, "POST", admin, VENUE_NOTICE, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(publish, "POST", admin, Map.of("scope", "X", "title", "t", "content", "c"), "USER",
                        "VALIDATION_ERROR"),
                row(publish, "DELETE", one, NONE, ANON, "AUTH_REQUIRED"),
                row(publish, "DELETE", one, NONE, "USER", "FORBIDDEN"),
                row(publish, "DELETE", one, NONE, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(publish, "DELETE", admin + "/abc", NONE, "USER", "VALIDATION_ERROR"));
    }

    /** 提交报修；处理报修（范围内）。 */
    static List<Arguments> repairRows() {
        String submit = "提交报修";
        String handle = "处理报修（范围内）";
        String admin = "/api/v1/admin/repairs";
        String one = admin + "/:repair";
        return List.of(
                row(submit, "POST", "/api/v1/repairs", REPAIR, ANON, "AUTH_REQUIRED"),
                row(submit, "POST", "/api/v1/repairs", REPAIR, "VENUE_ADMIN", "FORBIDDEN"),
                row(submit, "POST", "/api/v1/repairs", REPAIR, "SYS_ADMIN", "FORBIDDEN"),
                row(submit, "POST", "/api/v1/repairs", Map.of("description", " "), "SYS_ADMIN", "VALIDATION_ERROR"),
                row(submit, "GET", "/api/v1/repairs/me", NONE, ANON, "AUTH_REQUIRED"),
                row(submit, "GET", "/api/v1/repairs/me", NONE, "USER", "200"),
                row(submit, "GET", "/api/v1/repairs/me", NONE, "VENUE_ADMIN", "FORBIDDEN"),
                row(submit, "GET", "/api/v1/repairs/me", NONE, "SYS_ADMIN", "FORBIDDEN"),
                row(handle, "GET", admin, NONE, ANON, "AUTH_REQUIRED"),
                row(handle, "GET", admin, NONE, "USER", "FORBIDDEN"),
                row(handle, "GET", admin + "?venueId=2", NONE, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(handle, "GET", admin + "?status=X", NONE, "USER", "VALIDATION_ERROR"),
                row(handle, "PATCH", one, PROGRESS, ANON, "AUTH_REQUIRED"),
                row(handle, "PATCH", one, PROGRESS, "USER", "FORBIDDEN"),
                row(handle, "PATCH", one, PROGRESS, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(handle, "PATCH", one, Map.of("status", "X"), "USER", "VALIDATION_ERROR"));
    }

    /** 管理场馆管理员账号与授权范围；创建/停用用户账号（SA 专属：VA 得 FORBIDDEN，不是 FORBIDDEN_SCOPE）。 */
    static List<Arguments> userRows() {
        String manage = "管理场馆管理员账号与授权范围";
        String create = "创建/停用用户账号";
        String users = "/api/v1/admin/users";
        String one = users + "/:user";
        String scope = one + "/venue-scope";
        return List.of(
                row(manage, "GET", users, NONE, ANON, "AUTH_REQUIRED"),
                row(manage, "GET", users, NONE, "USER", "FORBIDDEN"),
                row(manage, "GET", users, NONE, "VENUE_ADMIN", "FORBIDDEN"),
                row(manage, "GET", users + "?role=X", NONE, "VENUE_ADMIN", "VALIDATION_ERROR"),
                row(create, "POST", users, ACCOUNT, ANON, "AUTH_REQUIRED"),
                row(create, "POST", users, ACCOUNT, "USER", "FORBIDDEN"),
                row(create, "POST", users, ACCOUNT, "VENUE_ADMIN", "FORBIDDEN"),
                row(create, "POST", users, Map.of("username", "x"), "VENUE_ADMIN", "VALIDATION_ERROR"),
                row(create, "PATCH", one, DISABLE, ANON, "AUTH_REQUIRED"),
                row(create, "PATCH", one, DISABLE, "USER", "FORBIDDEN"),
                row(create, "PATCH", one, DISABLE, "VENUE_ADMIN", "FORBIDDEN"),
                row(create, "PATCH", one, Map.of("status", "X"), "VENUE_ADMIN", "VALIDATION_ERROR"),
                row(manage, "PUT", scope, SCOPE, ANON, "AUTH_REQUIRED"),
                row(manage, "PUT", scope, SCOPE, "USER", "FORBIDDEN"),
                row(manage, "PUT", scope, SCOPE, "VENUE_ADMIN", "FORBIDDEN"),
                row(manage, "PUT", scope, Map.of(), "VENUE_ADMIN", "VALIDATION_ERROR"));
    }

    /** 查看管理员操作记录（范围内）。 */
    static List<Arguments> logRows() {
        String logs = "查看管理员操作记录（范围内）";
        return List.of(
                row(logs, "GET", "/api/v1/admin/logs", NONE, ANON, "AUTH_REQUIRED"),
                row(logs, "GET", "/api/v1/admin/logs", NONE, "USER", "FORBIDDEN"),
                row(logs, "GET", "/api/v1/admin/logs?venueId=2", NONE, "VENUE_ADMIN", "FORBIDDEN_SCOPE"),
                row(logs, "GET", "/api/v1/admin/logs?action=X", NONE, "USER", "VALIDATION_ERROR"));
    }

    @ParameterizedTest(name = "{0} → {5}")
    @MethodSource({"announcementRows", "repairRows", "userRows", "logRows"})
    void permissionMatrix(String name, String method, String path, Object body, String role, String expected)
            throws Exception {
        assertThat(badminton).as("矩阵中的场馆 id 2 为羽毛球馆").isEqualTo(2);
        String url = path.replace(":announcement", String.valueOf(badmintonAnnouncement))
                .replace(":repair", String.valueOf(badmintonRepair))
                .replace(":user", String.valueOf(zhangsan));
        MockHttpServletRequestBuilder builder = request(HttpMethod.valueOf(method), url);
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
            builder.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        }

        MvcResult result = mockMvc.perform(builder).andReturn();

        if ("200".equals(expected)) {
            assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        } else {
            assertError(result, ErrorCode.valueOf(expected));
        }
        assertThat(logCount()).isZero();
    }
}
