package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 S2 影响检查（docs/12 第 5.5 节、docs/10 第 5 节）：执行之后的效果。ImpactContractTests 已对五个接口覆盖 dryRun、
 * IMPACT_CONFIRMATION_REQUIRED、KEEP、CANCEL、REASON_REQUIRED 与日志；这里补“KEEP 只阻止新预约”“CANCEL 释放时段、预约人看到原因”
 * “预检之后新增的预约在执行时一并处理，报告与实际取消一致”（BE-2b 计划闸门答复第 6 条）。
 */
@DisplayName("ACC-M3-08 影响检查执行后的效果")
class ImpactFollowUpTest extends ImpactApiTestBase {

    private MvcResult book(long userId, long resourceId, String start) throws Exception {
        return send(HttpMethod.POST, "/api/v1/reservations", body("resourceId", resourceId, "serviceDate",
                TOMORROW.toString(), "startTime", start), userId, Role.USER);
    }

    private Map<String, Object> closureOnCourt1(Object... control) {
        return merge(body("startDate", TOMORROW.toString(), "endDate", TOMORROW.toString(), "resourceId", court1),
                body(control));
    }

    @Test
    @DisplayName("ACC-M3-08 KEEP：受影响预约保持 CONFIRMED、预约人仍可查看；新预约被拒（关闭 SLOT_NOT_AVAILABLE、维护与缩减数量 "
            + "RESOURCE_UNAVAILABLE、场馆关闭 VENUE_NOT_BOOKABLE）")
    void keepLeavesReservationsButBlocksNewBookings() throws Exception {
        long onCourt1 = reservation(zhangsan, court1, TOMORROW, "09:30");
        long onCourt2 = reservation(zhangsan, court2, TOMORROW, "09:30");
        long onCourt4 = reservation(zhangsan, court4, TOMORROW, "09:30");
        String keep = "KEEP";

        assertThat(asSys(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures",
                closureOnCourt1("onExistingReservations", keep), tennis).getResponse().getStatus()).isEqualTo(201);
        assertError(book(lisi, court1, "11:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertThat(asSys(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body("operationalStatus", "MAINTENANCE",
                "onExistingReservations", keep), court2).getResponse().getStatus()).isEqualTo(200);
        assertError(book(lisi, court2, "11:00"), ErrorCode.RESOURCE_UNAVAILABLE);
        assertThat(asSys(HttpMethod.PUT, "/api/v1/admin/venues/{id}/resource-count", body("count", 2,
                "onExistingReservations", keep), tennis).getResponse().getStatus()).isEqualTo(200);
        assertThat(resourceStatus(court4)).isEqualTo("DISABLED");
        assertError(book(lisi, court4, "11:00"), ErrorCode.RESOURCE_UNAVAILABLE);
        assertThat(asSys(HttpMethod.PATCH, "/api/v1/admin/venues/{id}", body("operationalStatus", "CLOSED",
                "onExistingReservations", keep), tennis).getResponse().getStatus()).isEqualTo(200);
        assertError(book(lisi, court3, "11:00"), ErrorCode.VENUE_NOT_BOOKABLE);

        for (long id : new long[] {onCourt1, onCourt2, onCourt4}) {
            assertThat(reservationStatus(id)).isEqualTo("CONFIRMED");
            JsonNode view = json(send(HttpMethod.GET, "/api/v1/reservations/{id}", null, zhangsan, Role.USER, id));
            assertThat(view.get("status").asText()).isEqualTo("CONFIRMED");
            assertThat(view.get("adminNote").isNull()).isTrue();
        }
        assertThat(jdbc.queryForObject("select count(*) from reservation where user_id = ?", Integer.class, lisi))
                .isZero();
    }

    @Test
    @DisplayName("ACC-M3-08 CANCEL：预约置 ADMIN_CANCELLED，预约人在“我的预约”中看到 adminNote；场地恢复开放后该时段可再预约")
    void cancelReleasesTheSlotAndTheOwnerSeesTheReason() throws Exception {
        long affected = reservation(zhangsan, court1, TOMORROW, "09:30");

        assertThat(asTennisAdmin(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body("operationalStatus",
                "MAINTENANCE", "onExistingReservations", "CANCEL", "reason", "球网更换"), court1).getResponse()
                .getStatus()).isEqualTo(200);
        JsonNode mine = json(send(HttpMethod.GET, "/api/v1/reservations/me", null, zhangsan, Role.USER))
                .get("items").get(0);
        assertThat(mine.get("id").asLong()).isEqualTo(affected);
        assertThat(mine.get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(mine.get("displayStatus").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(mine.get("adminNote").asText()).isEqualTo("球网更换");

        assertThat(asTennisAdmin(HttpMethod.PATCH, "/api/v1/admin/resources/{id}", body("operationalStatus", "OPEN"),
                court1).getResponse().getStatus()).isEqualTo(200);
        assertThat(book(lisi, court1, "09:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-08 预检之后新增的预约在执行时一并取消：cancelledIds 与日志的受影响 id 都包含它")
    void executionCancelsExactlyWhatItReports() throws Exception {
        long early = reservation(zhangsan, court1, TOMORROW, "09:30");
        String url = "/api/v1/admin/venues/{id}/closures";
        JsonNode preview = json(asSys(HttpMethod.POST, url, closureOnCourt1("dryRun", true), tennis));
        assertThat(briefIds(preview.get("impact"))).containsExactly(early);

        MvcResult late = book(lisi, court1, "11:00");
        assertThat(late.getResponse().getStatus()).isEqualTo(201);
        long lateId = json(late).get("id").asLong();

        JsonNode applied = json(asSys(HttpMethod.POST, url, closureOnCourt1("onExistingReservations", "CANCEL",
                "reason", "赛事"), tennis));
        assertThat(ids(applied.get("cancelledIds"))).containsExactly(early, lateId);
        assertThat(briefIds(applied.get("impact"))).containsExactly(early, lateId);
        assertThat(ids(snapshot(onlyLog(), "after_snapshot").get("affectedReservationIds")))
                .containsExactly(early, lateId);
        assertThat(reservationStatus(early)).isEqualTo("ADMIN_CANCELLED");
        assertThat(reservationStatus(lateId)).isEqualTo("ADMIN_CANCELLED");
    }
}
