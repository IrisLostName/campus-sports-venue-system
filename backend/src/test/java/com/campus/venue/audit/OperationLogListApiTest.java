package com.campus.venue.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** BE-6 L1、L2、T6：操作记录查询（可见性、越权、过滤、跨午夜、排序、分页、快照为 JSON 对象）。 */
class OperationLogListApiTest extends ImpactApiTestBase {

    private static final String LOGS = "/api/v1/admin/logs";

    /** 直接写库的日志；快照为 JSON 文本或 null。 */
    private long log(long adminId, Long venueId, LogAction action, LocalDateTime createdAt, String before,
            String after) {
        return jdbc.queryForObject("insert into admin_operation_log (admin_id, venue_id, action, target_type,"
                + " target_id, before_snapshot, after_snapshot, created_at) values (?, ?, ?, ?, 1, ?::jsonb, ?::jsonb,"
                + " ?) returning id", Long.class, adminId, venueId, action.name(), OperationLogWriter.targetTypeOf(action).name(), before, after,
                Timestamp.valueOf(createdAt));
    }

    private long log(long adminId, Long venueId, LocalDateTime createdAt) {
        return log(adminId, venueId, LogAction.VENUE_UPDATE, createdAt, null, null);
    }

    /** params 为“参数名, 值”交替（值原样作为查询参数）。 */
    private MvcResult list(long userId, Role role, String... params) throws Exception {
        MockHttpServletRequestBuilder builder = get(LOGS).header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        for (int i = 0; i < params.length; i += 2) {
            builder.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(builder).andReturn();
    }

    private List<Long> ids(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).get("items").forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    @Test
    @DisplayName("08 查看管理员操作记录（范围内）：VA 只见授权场馆的日志（含其他管理员写的），venue_id 为空与其他场馆的不可见；SA 全部")
    void venueAdminSeesOnlyLogsOfScopedVenues() throws Exception {
        long other = user("admin_other", Role.VENUE_ADMIN);
        long own = log(tennisAdmin, tennis, NOW.minusHours(3));
        long byOther = log(other, tennis, NOW.minusHours(2));
        long bySys = log(sysAdmin, tennis, NOW.minusHours(1));
        long otherVenue = log(sysAdmin, badminton, NOW.minusMinutes(30));
        long global = log(sysAdmin, null, NOW.minusMinutes(10));

        assertThat(ids(list(tennisAdmin, Role.VENUE_ADMIN))).containsExactly(bySys, byOther, own);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN))).containsExactly(global, otherVenue, bySys, byOther, own);
        assertThat(ids(list(tennisAdmin, Role.VENUE_ADMIN, "venueId", String.valueOf(tennis))))
                .containsExactly(bySys, byOther, own);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "venueId", String.valueOf(badminton))))
                .containsExactly(otherVenue);
    }

    @Test
    @DisplayName("08 查看管理员操作记录（范围内）：VA 给未授权或不存在的 venueId → FORBIDDEN_SCOPE；SA 不存在的场馆得空页")
    void givenVenueIsCheckedFirst() throws Exception {
        log(sysAdmin, badminton, NOW.minusHours(1));

        JsonNode error = assertError(list(tennisAdmin, Role.VENUE_ADMIN, "venueId", String.valueOf(badminton)),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(list(tennisAdmin, Role.VENUE_ADMIN, "venueId", "999999"), ErrorCode.FORBIDDEN_SCOPE);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "venueId", "999999"))).isEmpty();
    }

    @Test
    @DisplayName("L1 action 与日期过滤：两端含；dateFrom 晚于 dateTo 得空页；按 created_at、id 倒序")
    void actionAndDateFilters() throws Exception {
        long day10 = log(sysAdmin, tennis, LogAction.CLOSURE_ADD, LocalDateTime.of(2026, 10, 10, 12, 0), null, null);
        long day11Early = log(sysAdmin, tennis, LocalDateTime.of(2026, 10, 11, 0, 0, 0));
        long day11Late = log(sysAdmin, tennis, LocalDateTime.of(2026, 10, 11, 23, 59, 59));
        long day11LateTwin = log(sysAdmin, tennis, LocalDateTime.of(2026, 10, 11, 23, 59, 59));
        long day12 = log(sysAdmin, tennis, LogAction.CLOSURE_ADD, LocalDateTime.of(2026, 10, 12, 0, 0, 0), null,
                null);

        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "dateFrom", "2026-10-11", "dateTo", "2026-10-11")))
                .containsExactly(day11LateTwin, day11Late, day11Early);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "dateFrom", "2026-10-11")))
                .containsExactly(day12, day11LateTwin, day11Late, day11Early);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "dateTo", "2026-10-11")))
                .containsExactly(day11LateTwin, day11Late, day11Early, day10);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "action", "CLOSURE_ADD"))).containsExactly(day12, day10);
        assertThat(ids(list(sysAdmin, Role.SYS_ADMIN, "action", "CLOSURE_ADD", "dateTo", "2026-10-11")))
                .containsExactly(day10);
        JsonNode reversed = json(list(sysAdmin, Role.SYS_ADMIN, "dateFrom", "2026-10-12", "dateTo", "2026-10-11"));
        assertThat(reversed.get("items")).isEmpty();
        assertThat(reversed.get("total").asLong()).isZero();
    }

    @Test
    @DisplayName("L1 跨午夜（Clock 构造）：23:59:59.999 写的日志属于前一天，00:00:00 写的属于后一天")
    void midnightBoundaryFollowsTheLocalDateOfCreatedAt() throws Exception {
        clock.setLocal(LocalDateTime.of(2026, 10, 12, 23, 59, 59, 999_000_000));
        assertThat(asTennisAdmin(HttpMethod.POST, "/api/v1/admin/announcements", body("scope", "VENUE", "venueId",
                tennis, "title", "前一天", "content", "内容")).getResponse().getStatus()).isEqualTo(201);
        clock.setLocal(LocalDateTime.of(2026, 10, 13, 0, 0, 0));
        assertThat(asTennisAdmin(HttpMethod.POST, "/api/v1/admin/announcements", body("scope", "VENUE", "venueId",
                tennis, "title", "后一天", "content", "内容")).getResponse().getStatus()).isEqualTo(201);
        List<Long> written = jdbc.queryForList("select id from admin_operation_log order by id", Long.class);

        assertThat(ids(list(tennisAdmin, Role.VENUE_ADMIN, "dateTo", "2026-10-12"))).containsExactly(written.get(0));
        assertThat(ids(list(tennisAdmin, Role.VENUE_ADMIN, "dateFrom", "2026-10-13")))
                .containsExactly(written.get(1));
        assertThat(ids(list(tennisAdmin, Role.VENUE_ADMIN, "dateFrom", "2026-10-12", "dateTo", "2026-10-13")))
                .containsExactly(written.get(1), written.get(0));
    }

    @Test
    @DisplayName("L2 字段与 docs/12 一致；adminName 为姓名；before/after 为 JSON 对象（不是字符串），空为 null")
    void viewShapeAndSnapshotsAsJsonObjects() throws Exception {
        log(tennisAdmin, tennis, LogAction.REPAIR_UPDATE, NOW.minusHours(1),
                "{\"object\": {\"status\": \"SUBMITTED\"}, \"affectedReservationIds\": []}",
                "{\"object\": {\"status\": \"RESOLVED\"}, \"affectedReservationIds\": [7]}");
        log(tennisAdmin, tennis, NOW.minusHours(2));

        JsonNode items = json(list(tennisAdmin, Role.VENUE_ADMIN)).get("items");
        JsonNode first = items.get(0);
        List<String> keys = new ArrayList<>();
        first.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("id", "adminId", "adminName", "venueId", "action", "targetType", "targetId",
                "reason", "before", "after", "createdAt");
        assertThat(first.get("adminName").asText()).isEqualTo("用户admin_tennis");
        assertThat(first.get("action").asText()).isEqualTo("REPAIR_UPDATE");
        assertThat(first.get("targetType").asText()).isEqualTo("REPAIR");
        assertThat(first.get("reason").isNull()).isTrue();
        assertThat(first.get("before").isObject()).isTrue();
        assertThat(first.get("before").get("object").get("status").asText()).isEqualTo("SUBMITTED");
        assertThat(first.get("after").get("affectedReservationIds").get(0).asLong()).isEqualTo(7);
        assertThat(first.get("createdAt").asText()).isEqualTo("2026-10-12T07:30:15");
        assertThat(items.get(1).get("before").isNull()).isTrue();
        assertThat(items.get(1).get("after").isNull()).isTrue();
    }

    @Test
    @DisplayName("L1 分页：page、pageSize；超大页码得空页")
    void paging() throws Exception {
        for (int i = 0; i < 5; i++) {
            log(sysAdmin, tennis, NOW.minusMinutes(i));
        }
        JsonNode second = json(list(sysAdmin, Role.SYS_ADMIN, "page", "2", "pageSize", "2"));
        assertThat(second.get("items")).hasSize(2);
        assertThat(second.get("page").asInt()).isEqualTo(2);
        assertThat(second.get("pageSize").asInt()).isEqualTo(2);
        assertThat(second.get("total").asLong()).isEqualTo(5);
        assertThat(json(list(sysAdmin, Role.SYS_ADMIN, "page", "2147483647", "pageSize", "100")).get("items"))
                .isEmpty();
    }

    @Test
    @DisplayName("08 查看管理员操作记录：USER FORBIDDEN；未登录 401；格式（一次收集）先于角色")
    void roleAndFormat() throws Exception {
        assertError(list(zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(get(LOGS)).andReturn(), ErrorCode.AUTH_REQUIRED);

        JsonNode error = assertError(list(zhangsan, Role.USER, "venueId", "0", "action", "LOGIN", "page", "0",
                "pageSize", "0"), ErrorCode.VALIDATION_ERROR);
        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.get("venueId").asText()).isEqualTo("应为正整数");
        assertThat(fields.get("action").asText()).startsWith("应为 RESERVATION_CANCEL/").endsWith("/REPAIR_UPDATE 之一");
        assertThat(fields.get("page").asText()).isEqualTo("应为不小于 1 的整数");
        assertThat(fields.get("pageSize").asText()).isEqualTo("应为 1–100 的整数");

        JsonNode dates = assertError(list(zhangsan, Role.USER, "dateFrom", "2026-2-3", "dateTo", "2026-02-30"),
                ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(dates.get("dateFrom").asText()).isEqualTo("类型不符");
        assertThat(dates.get("dateTo").asText()).isEqualTo("类型不符");
    }
}
