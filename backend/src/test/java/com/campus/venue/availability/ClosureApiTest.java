package com.campus.venue.availability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-2b A5、A6、T3、T5、T7（BE-2a N3）：新增特殊关闭（201，dryRun 200）与删除（204）。日期两端都含；
 * 整馆或单个场地；结束早于开始 RULE_INVALID、场地不属于该场馆 VALIDATION_ERROR（均在授权范围之后）；允许过去日期；
 * 新增关闭后占用总览显示 CLOSED，删除后恢复。
 */
class ClosureApiTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/venues/{id}/closures";
    private static final String DELETE_URL = "/api/v1/admin/closures/{id}";

    private static Map<String, Object> closure(LocalDate start, LocalDate end, Long resourceId) {
        return body("startDate", start.toString(), "endDate", end.toString(), "resourceId", resourceId);
    }

    private String occupancyStatus(long resourceId, LocalDate date, String start) throws Exception {
        JsonNode body = json(mockMvc.perform(get("/api/v1/admin/venues/{id}/occupancy", tennis)
                .param("date", date.toString()).header(HttpHeaders.AUTHORIZATION, bearer(sysAdmin, Role.SYS_ADMIN)))
                .andReturn());
        for (JsonNode resource : body.get("resources")) {
            if (resource.get("resourceId").asLong() == resourceId) {
                for (JsonNode slot : resource.get("slots")) {
                    if (slot.get("startTime").asText().equals(start)) {
                        return slot.get("status").asText();
                    }
                }
            }
        }
        throw new AssertionError("没有该时段");
    }

    @Test
    void dateRangeIncludesBothEnds() throws Exception {
        reservation(zhangsan, court2, TOMORROW, "08:00");
        long first = reservation(zhangsan, court2, TOMORROW.plusDays(1), "08:00");
        long last = reservation(lisi, court3, TOMORROW.plusDays(2), "08:00");
        reservation(lisi, court3, TOMORROW.plusDays(3), "08:00");

        MvcResult result = asSys(HttpMethod.POST, URL, merge(closure(TOMORROW.plusDays(1), TOMORROW.plusDays(2), null),
                body("dryRun", true)), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(briefIds(json(result).get("impact"))).containsExactly(first, last);
        assertThat(logCount()).isZero();
    }

    @Test
    void resourceClosureAffectsOnlyThatResource() throws Exception {
        long onCourt2 = reservation(zhangsan, court2, TOMORROW, "08:00");
        reservation(lisi, court3, TOMORROW, "08:00");

        JsonNode impact = json(asSys(HttpMethod.POST, URL, merge(closure(TOMORROW, TOMORROW, court2),
                body("dryRun", true)), tennis)).get("impact");

        assertThat(briefIds(impact)).containsExactly(onCourt2);
    }

    @Test
    void addingReturns201WritesRuleAndLog() throws Exception {
        MvcResult result = asTennisAdmin(HttpMethod.POST, URL,
                merge(closure(TOMORROW, TOMORROW.plusDays(1), court2), body("reason", "换网")), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode data = json(result).get("data");
        long id = data.get("id").asLong();
        assertThat(data.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(data.get("resourceId").asLong()).isEqualTo(court2);
        assertThat(data.get("startDate").asText()).isEqualTo(TOMORROW.toString());
        assertThat(data.get("endDate").asText()).isEqualTo(TOMORROW.plusDays(1).toString());
        assertThat(data.get("reason").asText()).isEqualTo("换网");
        Map<String, Object> row = jdbc.queryForMap("select * from availability_rule where id = ?", id);
        assertThat(row.get("rule_type")).isEqualTo("CLOSURE");
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(row.get("created_by")).isEqualTo(tennisAdmin);
        assertThat(row.get("created_at")).isEqualTo(Timestamp.valueOf(NOW));
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("CLOSURE_ADD");
        assertThat(log.get("target_type")).isEqualTo("RULE");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("reason")).isEqualTo("换网");
        assertThat(snapshot(log, "before_snapshot").get("object").isNull()).isTrue();
        assertThat(snapshot(log, "after_snapshot").get("object").get("id").asLong()).isEqualTo(id);
    }

    @Test
    void blankReasonIsStoredAsNullAndPastDatesAreAllowed() throws Exception {
        MvcResult result = asSys(HttpMethod.POST, URL, merge(closure(TODAY.minusDays(10), TODAY.minusDays(9), null),
                body("reason", "  ")), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).get("data").get("reason").isNull()).isTrue();
        assertThat(onlyLog().get("reason")).isNull();
    }

    @Test
    void businessChecksComeAfterScope() throws Exception {
        Map<String, Object> reversed = closure(TOMORROW, TODAY, null);
        assertError(asTennisAdmin(HttpMethod.POST, URL, reversed, badminton), ErrorCode.FORBIDDEN_SCOPE);
        assertError(asSys(HttpMethod.POST, URL, reversed, 9999), ErrorCode.NOT_FOUND);
        JsonNode error = assertError(asSys(HttpMethod.POST, URL, reversed, tennis), ErrorCode.RULE_INVALID);
        assertThat(error.get("details").get("reason").asText()).isEqualTo("结束日期不能早于开始日期");
        for (long resourceId : new long[] {badmintonCourt, 9999}) {
            JsonNode fields = assertError(asSys(HttpMethod.POST, URL, closure(TODAY, TODAY, resourceId), tennis),
                    ErrorCode.VALIDATION_ERROR).get("details").get("fields");
            assertThat(fields.get("resourceId").asText()).isEqualTo("场地不属于该场馆");
        }
        assertThat(logCount()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from availability_rule where rule_type = 'CLOSURE'",
                Integer.class)).isZero();
    }

    @Test
    void fieldFormatsAreChecked() throws Exception {
        JsonNode fields = assertError(asSys(HttpMethod.POST, URL, body("resourceId", 0), tennis),
                ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("startDate").asText()).isEqualTo("必填");
        assertThat(fields.get("endDate").asText()).isEqualTo("必填");
        assertThat(fields.get("resourceId").asText()).isEqualTo("应为正整数");
        JsonNode badDate = assertError(asSys(HttpMethod.POST, URL, body("startDate", "2026-02-30",
                "endDate", "2026-03-01"), tennis), ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(badDate.has("startDate")).isTrue();
    }

    @Test
    void occupancyShowsClosedAfterAddingAndOpenAfterRemoving() throws Exception {
        assertThat(occupancyStatus(court2, TOMORROW, "09:30")).isEqualTo("AVAILABLE");

        long id = json(asSys(HttpMethod.POST, URL, closure(TOMORROW, TOMORROW, court2), tennis))
                .get("data").get("id").asLong();
        assertThat(occupancyStatus(court2, TOMORROW, "09:30")).isEqualTo("CLOSED");
        assertThat(occupancyStatus(court1, TOMORROW, "09:30")).isEqualTo("AVAILABLE");

        assertThat(asSys(HttpMethod.DELETE, DELETE_URL, null, id).getResponse().getStatus()).isEqualTo(204);
        assertThat(occupancyStatus(court2, TOMORROW, "09:30")).isEqualTo("AVAILABLE");
    }

    @Test
    void removingDeactivatesAndLogsClosureRemove() throws Exception {
        long id = fixtures.closure(tennis, null, TOMORROW, TOMORROW);
        long kept = reservation(zhangsan, court1, TOMORROW, "08:00");

        MvcResult result = asTennisAdmin(HttpMethod.DELETE, DELETE_URL, null, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(204);
        assertThat(result.getResponse().getContentAsString()).isEmpty();
        assertThat(jdbc.queryForObject("select status from availability_rule where id = ?", String.class, id))
                .isEqualTo("INACTIVE");
        assertThat(reservationStatus(kept)).isEqualTo("CONFIRMED");
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("CLOSURE_REMOVE");
        assertThat(log.get("target_type")).isEqualTo("RULE");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("reason")).isNull();
        JsonNode before = snapshot(log, "before_snapshot");
        assertThat(before.get("object").get("reason").asText()).isEqualTo("保养");
        assertThat(before.get("affectedReservationIds")).isEmpty();
        assertThat(snapshot(log, "after_snapshot").get("object").isNull()).isTrue();
    }

    @Test
    void removingMissingInactiveOrWeeklyRuleIsNotFound() throws Exception {
        long id = fixtures.closure(tennis, null, TOMORROW, TOMORROW);
        long weekly = fixtures.weekly(tennis, 1, "06:00", "07:30");
        assertThat(asSys(HttpMethod.DELETE, DELETE_URL, null, id).getResponse().getStatus()).isEqualTo(204);

        for (long target : new long[] {id, weekly, 9999}) {
            assertError(asSys(HttpMethod.DELETE, DELETE_URL, null, target), ErrorCode.NOT_FOUND);
        }
        assertThat(logs()).hasSize(1);
    }

    @Test
    void removingChecksScopeAndRole() throws Exception {
        long other = fixtures.closure(badminton, null, TOMORROW, TOMORROW);

        assertError(asTennisAdmin(HttpMethod.DELETE, DELETE_URL, null, other), ErrorCode.FORBIDDEN_SCOPE);
        assertError(send(HttpMethod.DELETE, DELETE_URL, null, zhangsan, Role.USER, other), ErrorCode.FORBIDDEN);
        assertThat(jdbc.queryForObject("select status from availability_rule where id = ?", String.class, other))
                .isEqualTo("ACTIVE");
        assertThat(logCount()).isZero();
    }
}
