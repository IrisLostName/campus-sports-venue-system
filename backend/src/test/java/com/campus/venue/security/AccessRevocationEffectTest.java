package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * TEST-1 S2 权限（ACC-M3-07、ACC-M3-02）：撤销授权与停用账号在下一次请求即生效（授权与账号状态每次请求查库，docs/08 第 3 节）。
 * AdminScopeRevocationTest 已覆盖管理端预约列表与取消；这里补影响检查写入、占用总览、统计、预约详情、场地数量与人员改派，
 * 并对三种角色各取一个接口验证停用。
 */
class AccessRevocationEffectTest extends ImpactApiTestBase {

    private void assertForbiddenScope(String endpoint, MvcResult result) throws Exception {
        JsonNode body = assertError(result, ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).as(endpoint).isEqualTo(tennis);
    }

    @Test
    @DisplayName("ACC-M3-07 撤销授权后同一令牌：影响写入、占用总览、统计、预约详情、场地数量、人员改派均 FORBIDDEN_SCOPE，数据与日志不变")
    void revokedVenueAdminIsForbiddenScopeOnEveryVenueBoundEndpoint() throws Exception {
        long booked = reservation(zhangsan, court1, TOMORROW, "09:30");
        String occupancy = "/api/v1/admin/venues/{id}/occupancy?date=" + TOMORROW;
        assertThat(asTennisAdmin(HttpMethod.GET, occupancy, null, tennis).getResponse().getStatus()).isEqualTo(200);

        assertThat(jdbc.update("update admin_venue_scope set status = 'REVOKED' where admin_id = ? and venue_id = ?",
                tennisAdmin, tennis)).isEqualTo(1);

        Map<String, Callable<MvcResult>> calls = new LinkedHashMap<>();
        calls.put("occupancy", () -> asTennisAdmin(HttpMethod.GET, occupancy, null, tennis));
        calls.put("closure", () -> asTennisAdmin(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures",
                body("startDate", TOMORROW.toString(), "endDate", TOMORROW.toString(), "onExistingReservations",
                        "CANCEL", "reason", "检修"), tennis));
        calls.put("resource", () -> asTennisAdmin(HttpMethod.PATCH, "/api/v1/admin/resources/{id}",
                body("operationalStatus", "MAINTENANCE", "onExistingReservations", "KEEP"), court1));
        calls.put("resource-count", () -> asTennisAdmin(HttpMethod.PUT, "/api/v1/admin/venues/{id}/resource-count",
                body("count", 2, "onExistingReservations", "KEEP"), tennis));
        calls.put("stats", () -> asTennisAdmin(HttpMethod.GET, "/api/v1/admin/stats/overview?venueId={id}", null,
                tennis));
        calls.put("detail", () -> asTennisAdmin(HttpMethod.GET, "/api/v1/reservations/{id}", null, booked));
        calls.put("reassign-user", () -> asTennisAdmin(HttpMethod.POST,
                "/api/v1/admin/reservations/{id}/reassign-user", body("userId", lisi, "reason", "代订"), booked));
        for (Map.Entry<String, Callable<MvcResult>> call : calls.entrySet()) {
            assertForbiddenScope(call.getKey(), call.getValue().call());
        }

        assertThat(logCount()).isZero();
        assertThat(reservationRow(booked)).containsEntry("status", "CONFIRMED").containsEntry("user_id", zhangsan);
        assertThat(resourceStatus(court1)).isEqualTo("OPEN");
        assertThat(jdbc.queryForObject("select count(*) from resource where venue_id = ? and operational_status = 'OPEN'",
                Integer.class, tennis)).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from availability_rule where rule_type = 'CLOSURE'",
                Integer.class)).isZero();
    }

    private MvcResult withToken(String authorization, MockHttpServletRequestBuilder request, Object body)
            throws Exception {
        request.header("Authorization", authorization);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(request).andReturn();
    }

    @Test
    @DisplayName("ACC-M3-02 停用账号在下一次请求即 ACCOUNT_DISABLED：USER 创建预约（第 1 步）、VA 管理员取消、SA 用户列表；数据不变")
    void disabledAccountsAreRejectedOnTheNextRequest() throws Exception {
        long booked = reservation(lisi, court2, TOMORROW, "09:30");
        String user = bearer(zhangsan, Role.USER);
        String venueAdmin = bearer(tennisAdmin, Role.VENUE_ADMIN);
        String sys = bearer(sysAdmin, Role.SYS_ADMIN);
        jdbc.update("update app_user set status = 'DISABLED' where id in (?, ?, ?)", zhangsan, tennisAdmin, sysAdmin);

        assertError(withToken(user, post("/api/v1/reservations"), body("resourceId", court1, "serviceDate",
                TOMORROW.toString(), "startTime", "11:00")), ErrorCode.ACCOUNT_DISABLED);
        assertError(withToken(venueAdmin, post("/api/v1/admin/reservations/{id}/cancel", booked),
                body("reason", "调整")), ErrorCode.ACCOUNT_DISABLED);
        assertError(withToken(sys, get("/api/v1/admin/users"), null), ErrorCode.ACCOUNT_DISABLED);

        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isEqualTo(1);
        assertThat(reservationStatus(booked)).isEqualTo("CONFIRMED");
        assertThat(logCount()).isZero();
    }
}
