package com.campus.venue.repair;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 R1、R2、T4：用户提交报修与查看自己的报修。 */
class RepairUserApiTest extends RepairApiTestBase {

    private MvcResult submit(long userId, Role role, Object body) throws Exception {
        return send(HttpMethod.POST, REPAIRS, body, userId, role);
    }

    @Test
    @DisplayName("08 提交报修：USER 提交 201，SUBMITTED，名称装载，字段与 docs/12 一致，不写管理员日志")
    void userSubmitsARepair() throws Exception {
        MvcResult result = submit(zhangsan, Role.USER, body("venueId", tennis, "resourceId", court2,
                "description", "  球网 破损 "));

        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(201);
        JsonNode created = json(result);
        List<String> keys = new ArrayList<>();
        created.fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("id", "venueId", "venueName", "resourceId", "resourceName", "reporterId",
                "reporterName", "description", "status", "resultNote", "createdAt", "updatedAt");
        assertThat(created.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(created.get("resourceName").asText()).isEqualTo("网球场2");
        assertThat(created.get("reporterId").asLong()).isEqualTo(zhangsan);
        assertThat(created.get("reporterName").asText()).isEqualTo("用户zhangsan");
        assertThat(created.get("description").asText()).isEqualTo("  球网 破损 ");
        assertThat(created.get("status").asText()).isEqualTo("SUBMITTED");
        assertThat(created.get("resultNote").isNull()).isTrue();
        assertThat(created.get("createdAt").asText()).isEqualTo("2026-10-12T08:30:15");
        assertThat(created.get("updatedAt").asText()).isEqualTo("2026-10-12T08:30:15");
        Map<String, Object> row = repairRow(created.get("id").asLong());
        assertThat(row.get("reporter_id")).isEqualTo(zhangsan);
        assertThat(row.get("handled_by")).isNull();
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("R1 不带场地也可；关闭的场馆也可报修（不看状态）")
    void resourceIsOptionalAndVenueStateIsIgnored() throws Exception {
        jdbc.update("update venue set operational_status = 'CLOSED' where id = ?", badminton);

        MvcResult result = submit(zhangsan, Role.USER, body("venueId", badminton, "description", "灯坏了"));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("resourceId").isNull()).isTrue();
        assertThat(json(result).get("resourceName").isNull()).isTrue();
    }

    @Test
    @DisplayName("R1 场地不属于该场馆 → VALIDATION_ERROR fields.resourceId；场馆或场地不存在 → NOT_FOUND")
    void resourceMustBelongToTheVenue() throws Exception {
        JsonNode error = assertError(submit(zhangsan, Role.USER, body("venueId", tennis, "resourceId",
                badmintonCourt, "description", "坏了")), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(error).get("resourceId").asText()).isEqualTo("场地不属于该场馆");
        assertError(submit(zhangsan, Role.USER, body("venueId", 999999, "description", "坏了")),
                ErrorCode.NOT_FOUND);
        assertError(submit(zhangsan, Role.USER, body("venueId", tennis, "resourceId", 999999,
                "description", "坏了")), ErrorCode.NOT_FOUND);
        assertThat(repairCount()).isZero();
    }

    @Test
    @DisplayName("R1 格式：venueId 必填正整数、resourceId 正整数、description 必填非空白 ≤ 500；先于角色")
    void submitValidation() throws Exception {
        JsonNode missing = assertError(submit(sysAdmin, Role.SYS_ADMIN, body("resourceId", 0, "description", " ")),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missing).get("venueId").asText()).isEqualTo("必填");
        assertThat(fields(missing).get("resourceId").asText()).isEqualTo("应为正整数");
        assertThat(fields(missing).get("description").asText()).isEqualTo("必填");

        JsonNode tooLong = assertError(submit(zhangsan, Role.USER, body("venueId", -1, "description",
                "长".repeat(501))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(tooLong).get("venueId").asText()).isEqualTo("应为正整数");
        assertThat(fields(tooLong).get("description").asText()).isEqualTo("不能超过 500 个字符");
        assertThat(submit(zhangsan, Role.USER, body("venueId", tennis, "description", "长".repeat(500)))
                .getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("08 提交报修：VA、SA 提交 FORBIDDEN；未登录 401")
    void onlyUsersSubmit() throws Exception {
        Map<String, Object> request = body("venueId", tennis, "description", "坏了");

        assertError(submit(tennisAdmin, Role.VENUE_ADMIN, request), ErrorCode.FORBIDDEN);
        assertError(submit(sysAdmin, Role.SYS_ADMIN, request), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(post(REPAIRS).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andReturn(), ErrorCode.AUTH_REQUIRED);
        assertThat(repairCount()).isZero();
    }

    @Test
    @DisplayName("08 提交报修（查看自己的）：R2 只见自己的，按提交时刻、id 倒序；VA、SA FORBIDDEN；未登录 401")
    void listMineShowsOnlyOwnReportsNewestFirst() throws Exception {
        long old = submitted(zhangsan, tennis, NOW.minusDays(2));
        long sameLow = submitted(zhangsan, badminton, NOW.minusDays(1));
        long sameHigh = repair(zhangsan, tennis, court1, "RESOLVED", "已修", NOW.minusDays(1));
        submitted(lisi, tennis, NOW.minusHours(1));

        MvcResult result = send(HttpMethod.GET, MINE, null, zhangsan, Role.USER);
        assertThat(arrayIds(result)).containsExactly(sameHigh, sameLow, old);
        assertThat(json(result).get(0).get("resourceName").asText()).isEqualTo("网球场1");
        assertThat(json(result).get(0).get("resultNote").asText()).isEqualTo("已修");
        assertThat(arrayIds(send(HttpMethod.GET, MINE, null, user("wangwu", Role.USER), Role.USER))).isEmpty();

        assertError(send(HttpMethod.GET, MINE, null, tennisAdmin, Role.VENUE_ADMIN), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.GET, MINE, null, sysAdmin, Role.SYS_ADMIN), ErrorCode.FORBIDDEN);
        assertError(mockMvc.perform(get(MINE)).andReturn(), ErrorCode.AUTH_REQUIRED);
    }
}
