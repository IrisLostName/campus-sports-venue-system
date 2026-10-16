package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 A2、T2、T6：POST /admin/reservations/{id}/cancel（docs/10 第 6 节）。ADMIN_CANCELLED、admin_note = 原因、
 * cancelled_at 与 updated_at 取 Clock、cancelled_by 为当前管理员、cancel_reason 不写；释放时段；写 RESERVATION_CANCEL 日志。
 * 阶段顺序与失败不写日志见 AdminOverridePhaseOrderTest。
 */
class AdminCancelApiTest extends AdminReservationApiTestBase {

    private long target;

    @BeforeEach
    void seedTarget() {
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
    }

    @Test
    @DisplayName("ACC-M3-06 SYS_ADMIN 取消：响应与库中状态、时间戳取 Clock，并写一行 RESERVATION_CANCEL 日志（前后快照）")
    void sysAdminCancelsAndLogs() throws Exception {
        jdbc.update("update reservation set admin_note = '旧备注', cancel_reason = null where id = ?", target);
        clock.advance(Duration.ofMinutes(5));
        LocalDateTime at = NOW.plusMinutes(5);

        JsonNode view = ok(cancelAsSys(target, body("reason", "场地临时检修")));

        assertThat(view.get("id").asLong()).isEqualTo(target);
        assertThat(view.get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(view.get("displayStatus").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(view.get("adminNote").asText()).isEqualTo("场地临时检修");
        assertThat(view.get("cancelledBy").asLong()).isEqualTo(sysAdmin);
        assertThat(view.get("cancelledAt").asText()).isEqualTo("2026-10-12T08:35:15");
        assertThat(view.get("cancelReason").isNull()).isTrue();
        Map<String, Object> row = reservationRow(target);
        assertThat(row.get("status")).isEqualTo("ADMIN_CANCELLED");
        assertThat(row.get("admin_note")).isEqualTo("场地临时检修");
        assertThat(row.get("cancelled_by")).isEqualTo(sysAdmin);
        assertThat(row.get("cancelled_at")).isEqualTo(Timestamp.valueOf(at));
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(at));
        assertThat(row.get("cancel_reason")).isNull();

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RESERVATION_CANCEL");
        assertThat(log.get("target_type")).isEqualTo("RESERVATION");
        assertThat(log.get("target_id")).isEqualTo(target);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(sysAdmin);
        assertThat(log.get("reason")).isEqualTo("场地临时检修");
        assertThat(log.get("created_at")).isEqualTo(Timestamp.valueOf(at));
        JsonNode before = snapshot(log, "before_snapshot");
        JsonNode after = snapshot(log, "after_snapshot");
        assertThat(before.get("object").get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(before.get("object").get("adminNote").asText()).isEqualTo("旧备注");
        assertThat(after.get("object")).isEqualTo(view);
        assertThat(ids(before.get("affectedReservationIds"))).containsExactly(target);
        assertThat(ids(after.get("affectedReservationIds"))).containsExactly(target);
    }

    @Test
    @DisplayName("授权范围内的 VENUE_ADMIN 可取消；原因按原样保存（不去首尾空白），200 个字符可以")
    void venueAdminCancelsWithReasonKeptVerbatim() throws Exception {
        JsonNode view = ok(cancelAsTennisAdmin(target, body("reason", "  雨天  ")));
        assertThat(view.get("adminNote").asText()).isEqualTo("  雨天  ");
        assertThat(view.get("cancelledBy").asLong()).isEqualTo(tennisAdmin);
        assertThat(onlyLog().get("reason")).isEqualTo("  雨天  ");

        long other = reservation(lisi, court2, TOMORROW, "09:30");
        String longest = "因".repeat(200);
        assertThat(ok(cancelAsTennisAdmin(other, body("reason", longest))).get("adminNote").asText())
                .isEqualTo(longest);
        assertThat(reservationRow(other).get("admin_note")).isEqualTo(longest);
    }

    @Test
    @DisplayName("已签到未结束（IN_USE）的预约可被管理员取消；使用记录保留")
    void checkedInReservationCanBeCancelled() throws Exception {
        long inUse = reservation(lisi, court2, TODAY, "08:00");
        fixtures.usage(inUse, TODAY.atTime(7, 50), null);

        JsonNode view = ok(cancelAsSys(inUse, body("reason", "突发停电")));

        assertThat(view.get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(view.get("checkInAt").isNull()).isFalse();
        assertThat(reservationStatus(inUse)).isEqualTo("ADMIN_CANCELLED");
        assertThat(jdbc.queryForObject("select count(*) from usage_record where reservation_id = ?", Integer.class,
                inUse)).isEqualTo(1);
    }

    @Test
    @DisplayName("签到窗口内、尚未签到（CHECKIN_OPEN）的预约可取消；取消后时段释放，他人可再预约")
    void cancellingReleasesTheSlot() throws Exception {
        long soon = reservation(zhangsan, court3, TODAY, "08:00");
        clock.setLocal(TODAY.atTime(7, 50));

        ok(cancelAsSys(soon, body("reason", "教学占用")));
        clock.reset();
        ok(cancelAsSys(target, body("reason", "教学占用")));

        MvcResult created = send(HttpMethod.POST, "/api/v1/reservations",
                body("resourceId", court1, "serviceDate", TOMORROW.toString(), "startTime", "09:30"),
                lisi, Role.USER);
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        assertThat(jdbc.queryForList("select status from reservation where resource_id = ? and service_date = ?"
                + " and start_time = '09:30' order by id", String.class, court1, TOMORROW))
                .isEqualTo(List.of("ADMIN_CANCELLED", "CONFIRMED"));
        assertThat(logCount()).isEqualTo(2);
    }
}
