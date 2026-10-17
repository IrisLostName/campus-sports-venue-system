package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 U4、T5、T7：整体替换场馆管理员的授权范围。 */
class VenueScopeReplaceApiTest extends AdminUserApiTestBase {

    private static final LocalDateTime LATER = LocalDateTime.of(2026, 10, 12, 9, 0, 0);

    private MvcResult replace(long adminId, Object venueIds) throws Exception {
        return asSys(HttpMethod.PUT, SCOPE, body("venueIds", venueIds), adminId);
    }

    private Map<String, Object> scopeRow(long adminId, long venueId) {
        return jdbc.queryForMap("select * from admin_venue_scope where admin_id = ? and venue_id = ?", adminId,
                venueId);
    }

    private MvcResult tennisNoticesWith(String token) throws Exception {
        return mockMvc.perform(get("/api/v1/admin/announcements").param("venueId", String.valueOf(tennis))
                .header(HttpHeaders.AUTHORIZATION, token)).andReturn();
    }

    @Test
    @DisplayName("ACC-M3-07 08 管理场馆管理员账号与授权范围：撤销后同一令牌下一次请求即 FORBIDDEN_SCOPE；重新授权恢复")
    void revocationTakesEffectOnTheNextRequestAndRegrantRestores() throws Exception {
        String token = bearer(tennisAdmin, Role.VENUE_ADMIN);
        assertThat(tennisNoticesWith(token).getResponse().getStatus()).isEqualTo(200);

        JsonNode revoked = json(replace(tennisAdmin, List.of()));
        assertThat(revoked.get("venueIds").toString()).isEqualTo("[]");
        assertThat(scopeRow(tennisAdmin, tennis).get("status")).isEqualTo("REVOKED");
        JsonNode error = assertError(tennisNoticesWith(token), ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(tennis);

        clock.setLocal(LATER);
        JsonNode regranted = json(replace(tennisAdmin, List.of(tennis)));
        assertThat(regranted.get("venueIds").toString()).isEqualTo("[" + tennis + "]");
        Map<String, Object> row = scopeRow(tennisAdmin, tennis);
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(row.get("granted_at").toString()).isEqualTo("2026-10-12 09:00:00.0");
        assertThat(scopeRows(tennisAdmin)).hasSize(1);
        assertThat(tennisNoticesWith(token).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("U4 整体替换：新增插入、不在列表中的撤销、重复 id 去重；SCOPE_UPDATE 前后快照与目标")
    void replacesTheWholeSet() throws Exception {
        long third = fixtures.bookableVenue("游泳馆");
        clock.setLocal(LATER);

        MvcResult result = replace(tennisAdmin, List.of(badminton, third, badminton));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode after = json(result);
        assertThat(after.get("venueIds").toString()).isEqualTo("[" + badminton + "," + third + "]");
        assertThat(scopeRow(tennisAdmin, tennis).get("status")).isEqualTo("REVOKED");
        assertThat(scopeRow(tennisAdmin, badminton).get("status")).isEqualTo("ACTIVE");
        assertThat(scopeRow(tennisAdmin, badminton).get("granted_by")).isEqualTo(sysAdmin);
        assertThat(scopeRows(tennisAdmin)).hasSize(3);

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("SCOPE_UPDATE");
        assertThat(log.get("target_type")).isEqualTo("SCOPE");
        assertThat(log.get("target_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("venue_id")).isNull();
        assertThat(log.get("admin_id")).isEqualTo(sysAdmin);
        assertThat(snapshot(log, "before_snapshot").get("object").get("venueIds").toString())
                .isEqualTo("[" + tennis + "]");
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(after);
    }

    @Test
    @DisplayName("U4 无变化的替换：行不动（granted_at 不变）但仍写 SCOPE_UPDATE（与 mock 一致，API-SYNC）")
    void unchangedReplacementStillLogs() throws Exception {
        Object grantedAt = scopeRow(tennisAdmin, tennis).get("granted_at");
        clock.setLocal(LATER);

        assertThat(replace(tennisAdmin, List.of(tennis)).getResponse().getStatus()).isEqualTo(200);

        assertThat(scopeRow(tennisAdmin, tennis).get("granted_at")).isEqualTo(grantedAt);
        assertThat(onlyLog().get("action")).isEqualTo("SCOPE_UPDATE");
    }

    @Test
    @DisplayName("U4 有效期将被清空：未生效或已过期的授权在列表中 → 立即长期有效，granted_at 取 Clock")
    void listedScopesBecomeImmediatelyAndPermanentlyActive() throws Exception {
        long admin = user("admin_dated", Role.VENUE_ADMIN);
        fixtures.grant(admin, tennis, "ACTIVE", TODAY.plusDays(3), null, tennisAdmin);
        fixtures.grant(admin, badminton, "ACTIVE", null, TODAY.minusDays(1), tennisAdmin);
        clock.setLocal(LATER);

        JsonNode after = json(replace(admin, List.of(tennis, badminton)));

        assertThat(after.get("venueIds").toString()).isEqualTo("[" + tennis + "," + badminton + "]");
        for (Map<String, Object> row : scopeRows(admin)) {
            assertThat(row.get("valid_from")).isNull();
            assertThat(row.get("valid_to")).isNull();
            assertThat(row.get("granted_by")).isEqualTo(sysAdmin);
            assertThat(row.get("granted_at").toString()).isEqualTo("2026-10-12 09:00:00.0");
        }
    }

    @Test
    @DisplayName("U4 失败：目标不是 VENUE_ADMIN → INVALID_STATE {status: 角色}；不存在 NOT_FOUND；不存在场馆；VA、USER FORBIDDEN")
    void replaceFailures() throws Exception {
        JsonNode notAdmin = assertError(replace(zhangsan, List.of(tennis)), ErrorCode.INVALID_STATE);
        assertThat(notAdmin.get("details").get("status").asText()).isEqualTo("USER");
        JsonNode sys = assertError(replace(sysAdmin, List.of()), ErrorCode.INVALID_STATE);
        assertThat(sys.get("details").get("status").asText()).isEqualTo("SYS_ADMIN");
        assertError(replace(999999, List.of()), ErrorCode.NOT_FOUND);
        JsonNode missing = assertError(replace(tennisAdmin, List.of(tennis, 999999)), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missing).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        assertError(asTennisAdmin(HttpMethod.PUT, SCOPE, body("venueIds", List.of()), tennisAdmin),
                ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.PUT, SCOPE, body("venueIds", List.of()), zhangsan, Role.USER, tennisAdmin),
                ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(put(SCOPE, tennisAdmin).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn(), ErrorCode.AUTH_REQUIRED);

        assertThat(scopeRow(tennisAdmin, tennis).get("status")).isEqualTo("ACTIVE");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("U4 格式：venueIds 必填（null 亦然）、元素须为正整数；非数字元素为 venueIds[0]“类型不符”；先于角色")
    void replaceValidation() throws Exception {
        JsonNode missing = assertError(asSys(HttpMethod.PUT, SCOPE, body(), tennisAdmin), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missing).get("venueIds").asText()).isEqualTo("必填");
        JsonNode nullList = assertError(asSys(HttpMethod.PUT, SCOPE, body("venueIds", null), tennisAdmin),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(nullList).get("venueIds").asText()).isEqualTo("必填");
        JsonNode badElement = assertError(send(HttpMethod.PUT, SCOPE, body("venueIds", Arrays.asList(tennis, -1)),
                zhangsan, Role.USER, tennisAdmin), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(badElement).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        JsonNode nullElement = assertError(replace(tennisAdmin, Arrays.asList(tennis, null)),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(nullElement).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        JsonNode typed = assertError(replace(tennisAdmin, List.of("x")), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(typed).get("venueIds[0]").asText()).isEqualTo("类型不符");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("U4 并发：同一管理员的两次替换因锁定用户行而串行，均 200，最终为其中之一，两条日志、无 500")
    void concurrentReplacementsOfOneAdminAreSerialized() throws Exception {
        long third = fixtures.bookableVenue("游泳馆");
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        tasks.add(() -> replace(tennisAdmin, List.of(badminton, third)));
        tasks.add(() -> replace(tennisAdmin, List.of(third, tennis)));

        List<MvcResult> results = ConcurrentRequests.runTogether(tasks);

        assertThat(results).allSatisfy(result -> assertThat(result.getResponse().getStatus()).isEqualTo(200));
        List<Long> active = jdbc.queryForList("select venue_id from admin_venue_scope where admin_id = ?"
                + " and status = 'ACTIVE' order by venue_id", Long.class, tennisAdmin);
        assertThat(active).isIn(List.of(badminton, third), List.of(tennis, third));
        assertThat(scopeRows(tennisAdmin)).hasSize(3);
        assertThat(logCount()).isEqualTo(2);
    }
}
