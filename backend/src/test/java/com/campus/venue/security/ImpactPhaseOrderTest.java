package com.campus.venue.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * BE-2b 第 3 节、T6：阶段顺序 认证 → 字段格式 → REASON_REQUIRED → 角色 → VA 专属字段 FORBIDDEN → NOT_FOUND →
 * FORBIDDEN_SCOPE → 业务校验（ACC-M3-07 的授权范围已在 BE-1 标注，这里只验证顺序）。
 */
class ImpactPhaseOrderTest extends ImpactApiTestBase {

    private static final String VENUE_URL = "/api/v1/admin/venues/{id}";

    @Test
    void authenticationComesFirst() throws Exception {
        assertError(mockMvc.perform(patch(VENUE_URL, tennis).contentType("application/json")
                .content("{\"name\":\"  \"}")).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void reasonRequiredComesBeforeVenueAdminFieldCheck() throws Exception {
        assertError(asTennisAdmin(HttpMethod.PATCH, VENUE_URL, body("operationalStatus", "CLOSED",
                "onExistingReservations", "CANCEL"), tennis), ErrorCode.REASON_REQUIRED);
        assertError(asTennisAdmin(HttpMethod.PATCH, VENUE_URL, body("operationalStatus", "CLOSED",
                "onExistingReservations", "CANCEL", "reason", "检修"), 9999), ErrorCode.FORBIDDEN);
    }

    @Test
    void notFoundComesBeforeScopeAndScopeBeforeBusinessChecks() throws Exception {
        assertError(asTennisAdmin(HttpMethod.PUT, VENUE_URL + "/resource-count", body("count", 1), 9999),
                ErrorCode.NOT_FOUND);
        assertError(asTennisAdmin(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body("name", "羽毛球场1"),
                badmintonCourt), ErrorCode.FORBIDDEN_SCOPE);
        assertError(asTennisAdmin(HttpMethod.PUT, VENUE_URL + "/availability-rules/weekly",
                body("windows", List.of(body("weekday", 1, "openTime", "09:00", "closeTime", "08:00"))), badminton),
                ErrorCode.FORBIDDEN_SCOPE);
    }

    @Test
    void userIsForbiddenOnEveryEndpoint() throws Exception {
        assertError(send(HttpMethod.PATCH, VENUE_URL, body("description", "x"), zhangsan, Role.USER, tennis),
                ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body(), zhangsan, Role.USER, court1),
                ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.PUT, VENUE_URL + "/resource-count", body("count", 4), zhangsan, Role.USER,
                tennis), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.PUT, VENUE_URL + "/availability-rules/weekly", body("windows", List.of()),
                zhangsan, Role.USER, tennis), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.POST, VENUE_URL + "/closures", body("startDate", TODAY.toString(),
                "endDate", TODAY.toString()), zhangsan, Role.USER, tennis), ErrorCode.FORBIDDEN);
    }
}
