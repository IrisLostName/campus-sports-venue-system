package com.campus.venue.repair;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 R3、R4、T4、T7：管理端报修列表与处理。 */
class RepairAdminApiTest extends RepairApiTestBase {

    private MvcResult listAs(long userId, Role role, String query) throws Exception {
        return send(HttpMethod.GET, ADMIN + query, null, userId, role);
    }

    @Test
    @DisplayName("08 处理报修（范围内）：VA 只见授权场馆，SA 全部；按提交时刻、id 倒序；status 与 venueId 过滤")
    void adminListScopeAndFilters() throws Exception {
        long tennisOld = submitted(zhangsan, tennis, NOW.minusDays(2));
        long tennisResolved = repair(lisi, tennis, court1, "RESOLVED", "已修", NOW.minusDays(1));
        long badmintonNew = submitted(zhangsan, badminton, NOW.minusHours(1));

        assertThat(pageIds(listAs(tennisAdmin, Role.VENUE_ADMIN, ""))).containsExactly(tennisResolved, tennisOld);
        assertThat(pageIds(listAs(sysAdmin, Role.SYS_ADMIN, "")))
                .containsExactly(badmintonNew, tennisResolved, tennisOld);
        assertThat(pageIds(listAs(sysAdmin, Role.SYS_ADMIN, "?status=SUBMITTED")))
                .containsExactly(badmintonNew, tennisOld);
        assertThat(pageIds(listAs(sysAdmin, Role.SYS_ADMIN, "?venueId=" + badminton))).containsExactly(badmintonNew);
        assertThat(pageIds(listAs(tennisAdmin, Role.VENUE_ADMIN, "?venueId=" + tennis + "&status=RESOLVED")))
                .containsExactly(tennisResolved);
        JsonNode item = json(listAs(tennisAdmin, Role.VENUE_ADMIN, "")).get("items").get(0);
        assertThat(item.get("reporterName").asText()).isEqualTo("用户lisi");
        assertThat(item.get("resourceName").asText()).isEqualTo("网球场1");
    }

    @Test
    @DisplayName("08 处理报修（范围内）：VA 给未授权或不存在的 venueId → FORBIDDEN_SCOPE；SA 不存在的场馆得空页")
    void adminListChecksTheGivenVenue() throws Exception {
        JsonNode error = assertError(listAs(tennisAdmin, Role.VENUE_ADMIN, "?venueId=" + badminton),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(listAs(tennisAdmin, Role.VENUE_ADMIN, "?venueId=999999"), ErrorCode.FORBIDDEN_SCOPE);
        assertThat(pageIds(listAs(sysAdmin, Role.SYS_ADMIN, "?venueId=999999"))).isEmpty();
    }

    @Test
    @DisplayName("R3 只接受 page，pageSize 固定 20；格式先于角色；USER FORBIDDEN；未登录 401")
    void adminListPagingRoleAndFormat() throws Exception {
        for (int i = 0; i < 21; i++) {
            submitted(zhangsan, tennis, NOW.minusMinutes(i + 1));
        }
        JsonNode first = json(listAs(sysAdmin, Role.SYS_ADMIN, "?pageSize=100"));
        assertThat(first.get("items")).hasSize(20);
        assertThat(first.get("pageSize").asInt()).isEqualTo(20);
        assertThat(first.get("total").asLong()).isEqualTo(21);
        assertThat(json(listAs(sysAdmin, Role.SYS_ADMIN, "?page=2")).get("items")).hasSize(1);
        assertThat(json(listAs(sysAdmin, Role.SYS_ADMIN, "?page=999999999")).get("items")).isEmpty();

        assertError(listAs(zhangsan, Role.USER, ""), ErrorCode.FORBIDDEN);
        JsonNode error = assertError(listAs(zhangsan, Role.USER, "?status=DONE&venueId=0&page=0"),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(error).get("status").asText()).isEqualTo("应为 SUBMITTED/IN_PROGRESS/RESOLVED 之一");
        assertThat(fields(error).get("venueId").asText()).isEqualTo("应为正整数");
        assertThat(fields(error).get("page").asText()).isEqualTo("应为不小于 1 的整数");
        assertError(mockMvc.perform(get(ADMIN)).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({"SUBMITTED, IN_PROGRESS", "SUBMITTED, RESOLVED", "IN_PROGRESS, RESOLVED"})
    @DisplayName("R4 合法迁移：200，handled_by 为当前管理员，updated_at 取 Clock，写 REPAIR_UPDATE")
    void legalTransitions(String from, String to) throws Exception {
        long id = repair(zhangsan, tennis, null, from, null, NOW.minusDays(1));
        clock.setLocal(LocalDateTime.of(2026, 10, 12, 9, 15, 0));

        MvcResult result = asTennisAdmin(HttpMethod.PATCH, UPDATE, body("status", to, "resultNote", "已处理"), id);

        JsonNode after = json(result);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(after.get("status").asText()).isEqualTo(to);
        assertThat(after.get("resultNote").asText()).isEqualTo("已处理");
        assertThat(after.get("updatedAt").asText()).isEqualTo("2026-10-12T09:15:00");
        assertThat(after.get("createdAt").asText()).isEqualTo("2026-10-11T08:30:15");
        Map<String, Object> row = repairRow(id);
        assertThat(row.get("handled_by")).isEqualTo(tennisAdmin);
        assertThat(row.get("status")).isEqualTo(to);

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("REPAIR_UPDATE");
        assertThat(log.get("target_type")).isEqualTo("REPAIR");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("reason")).isNull();
        assertThat(snapshot(log, "before_snapshot").get("object").get("status").asText()).isEqualTo(from);
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(after);
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource({"IN_PROGRESS, IN_PROGRESS", "RESOLVED, RESOLVED", "RESOLVED, IN_PROGRESS"})
    @DisplayName("R4 非法迁移（逆向或重复）：INVALID_STATE {status: 当前状态}，不改不写日志")
    void illegalTransitions(String from, String to) throws Exception {
        long id = repair(zhangsan, tennis, null, from, "原结果", NOW.minusDays(1));

        JsonNode error = assertError(asSys(HttpMethod.PATCH, UPDATE, body("status", to, "resultNote", "再处理"), id),
                ErrorCode.INVALID_STATE);

        assertThat(error.get("details").get("status").asText()).isEqualTo(from);
        assertThat(repairRow(id).get("status")).isEqualTo(from);
        assertThat(repairRow(id).get("result_note")).isEqualTo("原结果");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("R4 未给 resultNote 时保留原值；给了则替换")
    void resultNoteIsKeptWhenOmitted() throws Exception {
        long id = repair(zhangsan, tennis, null, "SUBMITTED", "初步判断", NOW.minusDays(1));

        JsonNode progress = json(asSys(HttpMethod.PATCH, UPDATE, body("status", "IN_PROGRESS"), id));
        assertThat(progress.get("resultNote").asText()).isEqualTo("初步判断");

        JsonNode resolved = json(asSys(HttpMethod.PATCH, UPDATE, body("status", "RESOLVED", "resultNote", "已更换"),
                id));
        assertThat(resolved.get("resultNote").asText()).isEqualTo("已更换");
        assertThat(repairRow(id).get("handled_by")).isEqualTo(sysAdmin);
    }

    @Test
    @DisplayName("R4 格式：status 必填两值之一；RESOLVED 缺或空白 resultNote → 必填；可选时空白 → 不能为空；≤ 500；先于角色")
    void updateValidation() throws Exception {
        long id = submitted(zhangsan, tennis, NOW.minusDays(1));

        JsonNode resolved = assertError(send(HttpMethod.PATCH, UPDATE, body("status", "RESOLVED"), zhangsan,
                Role.USER, id), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(resolved).get("resultNote").asText()).isEqualTo("必填");
        JsonNode blank = assertError(asSys(HttpMethod.PATCH, UPDATE, body("status", "RESOLVED", "resultNote", "  "),
                id), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(blank).get("resultNote").asText()).isEqualTo("必填");
        JsonNode optionalBlank = assertError(asSys(HttpMethod.PATCH, UPDATE, body("status", "IN_PROGRESS",
                "resultNote", " "), id), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(optionalBlank).get("resultNote").asText()).isEqualTo("不能为空");
        JsonNode tooLong = assertError(asSys(HttpMethod.PATCH, UPDATE, body("status", "SUBMITTED",
                "resultNote", "长".repeat(501)), id), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(tooLong).get("status").asText()).isEqualTo("应为 IN_PROGRESS/RESOLVED 之一");
        assertThat(fields(tooLong).get("resultNote").asText()).isEqualTo("不能超过 500 个字符");
        JsonNode missing = assertError(asSys(HttpMethod.PATCH, UPDATE, body(), id), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missing).get("status").asText()).isEqualTo("必填");

        assertThat(repairRow(id).get("status")).isEqualTo("SUBMITTED");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("08 处理报修（范围内）：VA 越权 FORBIDDEN_SCOPE；不存在 NOT_FOUND；USER FORBIDDEN；未登录 401")
    void updateChecks() throws Exception {
        long other = submitted(zhangsan, badminton, NOW.minusDays(1));
        Map<String, Object> request = body("status", "IN_PROGRESS");

        JsonNode scope = assertError(asTennisAdmin(HttpMethod.PATCH, UPDATE, request, other),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(scope.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(asTennisAdmin(HttpMethod.PATCH, UPDATE, request, 999999), ErrorCode.NOT_FOUND);
        assertError(send(HttpMethod.PATCH, UPDATE, request, zhangsan, Role.USER, other), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(patch(UPDATE, other)).andReturn(), ErrorCode.AUTH_REQUIRED);

        assertThat(repairRow(other).get("status")).isEqualTo("SUBMITTED");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("C1 阶段顺序：VA 处理范围外已 RESOLVED 的报修 → FORBIDDEN_SCOPE 先于 INVALID_STATE，不改不写日志")
    void scopeIsCheckedBeforeTheTransition() throws Exception {
        long other = repair(zhangsan, badminton, null, "RESOLVED", "原结果", NOW.minusDays(1));

        JsonNode error = assertError(asTennisAdmin(HttpMethod.PATCH, UPDATE, body("status", "IN_PROGRESS"), other),
                ErrorCode.FORBIDDEN_SCOPE);

        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertThat(repairRow(other).get("status")).isEqualTo("RESOLVED");
        assertThat(repairRow(other).get("result_note")).isEqualTo("原结果");
        assertThat(logCount()).isZero();
    }
}
