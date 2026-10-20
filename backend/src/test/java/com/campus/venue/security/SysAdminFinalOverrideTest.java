package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 S2 权限（ACC-M3-06）：系统管理员拥有最终覆盖权，可以推翻场馆管理员的关闭或改派（docs/08 第 3 节第 3 条、docs/03 第 7 节）。
 * 两次操作各写一条日志，操作人分别为场馆管理员与系统管理员，前后快照衔接。
 */
class SysAdminFinalOverrideTest extends ImpactApiTestBase {

    @Test
    @DisplayName("ACC-M3-06 SA 停用 VA 新增的关闭规则：204，规则 INACTIVE；日志 CLOSURE_ADD（VA）与 CLOSURE_REMOVE（SA）")
    void sysAdminRemovesAClosureAddedByAVenueAdmin() throws Exception {
        MvcResult added = asTennisAdmin(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures",
                body("startDate", TOMORROW.toString(), "endDate", TOMORROW.toString(), "reason", "保养"), tennis);
        assertThat(added.getResponse().getStatus()).isEqualTo(201);
        long closure = json(added).get("data").get("id").asLong();

        MvcResult removed = asSys(HttpMethod.DELETE, "/api/v1/admin/closures/{id}", null, closure);

        assertThat(removed.getResponse().getStatus()).isEqualTo(204);
        assertThat(jdbc.queryForObject("select status from availability_rule where id = ?", String.class, closure))
                .isEqualTo("INACTIVE");
        List<Map<String, Object>> logs = logs();
        assertThat(logs).extracting(log -> log.get("action")).containsExactly("CLOSURE_ADD", "CLOSURE_REMOVE");
        assertThat(logs).extracting(log -> log.get("admin_id")).containsExactly(tennisAdmin, sysAdmin);
        assertThat(logs).extracting(log -> log.get("target_id")).containsExactly(closure, closure);
    }

    @Test
    @DisplayName("ACC-M3-06 SA 推翻 VA 的资源改派：预约原地再改派、admin_note 为 SA 的原因；两条日志前后快照衔接、操作人各自记录")
    void sysAdminReassignsAReservationAVenueAdminReassigned() throws Exception {
        long booked = reservation(zhangsan, court1, TOMORROW, "09:30");
        String url = "/api/v1/admin/reservations/{id}/reassign-resource";
        assertThat(asTennisAdmin(HttpMethod.POST, url, body("resourceId", court2, "serviceDate", TOMORROW.toString(),
                "startTime", "09:30", "reason", "网球场1维修"), booked).getResponse().getStatus()).isEqualTo(200);

        MvcResult overridden = asSys(HttpMethod.POST, url, body("resourceId", court3, "serviceDate",
                TOMORROW.toString(), "startTime", "11:00", "reason", "统一调度"), booked);

        assertThat(overridden.getResponse().getStatus()).isEqualTo(200);
        Map<String, Object> row = reservationRow(booked);
        assertThat(row.get("resource_id")).isEqualTo(court3);
        assertThat(row.get("start_time").toString()).isEqualTo("11:00:00");
        assertThat(row.get("status")).isEqualTo("CONFIRMED");
        assertThat(row.get("admin_note")).isEqualTo("统一调度");
        List<Map<String, Object>> logs = logs();
        assertThat(logs).extracting(log -> log.get("admin_id")).containsExactly(tennisAdmin, sysAdmin);
        JsonNode firstAfter = snapshot(logs.get(0), "after_snapshot").get("object");
        JsonNode secondBefore = snapshot(logs.get(1), "before_snapshot").get("object");
        JsonNode secondAfter = snapshot(logs.get(1), "after_snapshot").get("object");
        assertThat(firstAfter.get("resourceId").asLong()).isEqualTo(court2);
        assertThat(secondBefore.get("resourceId").asLong()).isEqualTo(court2);
        assertThat(secondAfter.get("resourceId").asLong()).isEqualTo(court3);
        assertThat(logs.get(1).get("reason")).isEqualTo("统一调度");
    }
}
