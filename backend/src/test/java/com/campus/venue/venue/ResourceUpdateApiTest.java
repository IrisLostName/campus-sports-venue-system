package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-2b A2、T3、T5、T6：PATCH /admin/resources/{id}。改名、排序不写日志；同场馆重名；
 * 只有状态确有变化且改为 MAINTENANCE/DISABLED 才做影响检查；授权范围按所属场馆。
 */
class ResourceUpdateApiTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/resources/{id}";

    private Map<String, Object> resourceRow(long id) {
        return jdbc.queryForMap("select * from resource where id = ?", id);
    }

    @Test
    void renameAndReorderWriteNoLogAndStampUpdatedAt() throws Exception {
        clock.advance(Duration.ofMinutes(7));

        MvcResult result = asTennisAdmin(HttpMethod.PATCH, URL, body("name", "中心场", "sortOrder", 0), court2);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode response = json(result);
        assertThat(response.get("applied").asBoolean()).isTrue();
        JsonNode data = response.get("data");
        assertThat(data.get("id").asLong()).isEqualTo(court2);
        assertThat(data.get("venueId").asLong()).isEqualTo(tennis);
        assertThat(data.get("name").asText()).isEqualTo("中心场");
        assertThat(data.get("sortOrder").asInt()).isZero();
        assertThat(data.get("resourceType").asText()).isEqualTo("COURT");
        assertThat(data.get("operationalStatus").asText()).isEqualTo("OPEN");
        Map<String, Object> row = resourceRow(court2);
        assertThat(row.get("name")).isEqualTo("中心场");
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW.plusMinutes(7)));
        assertThat(logCount()).isZero();
    }

    @Test
    void sameStatusIsNoChangeAndWritesNoLog() throws Exception {
        reservation(zhangsan, court2, TOMORROW, "08:00");

        MvcResult result = asSys(HttpMethod.PATCH, URL, body("operationalStatus", "OPEN"), court2);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(logCount()).isZero();
    }

    @Test
    void statusChangeWritesResourceStatusLog() throws Exception {
        MvcResult result = asTennisAdmin(HttpMethod.PATCH, URL,
                body("operationalStatus", "DISABLED", "reason", "老化"), court3);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RESOURCE_STATUS_CHANGE");
        assertThat(log.get("target_type")).isEqualTo("RESOURCE");
        assertThat(log.get("target_id")).isEqualTo(court3);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(log.get("admin_id")).isEqualTo(tennisAdmin);
        assertThat(log.get("reason")).isEqualTo("老化");
        assertThat(log.get("created_at")).isEqualTo(Timestamp.valueOf(NOW));
        assertThat(snapshot(log, "before_snapshot").get("object").get("operationalStatus").asText())
                .isEqualTo("OPEN");
        JsonNode after = snapshot(log, "after_snapshot").get("object");
        assertThat(after.get("operationalStatus").asText()).isEqualTo("DISABLED");
        assertThat(after.get("name").asText()).isEqualTo("网球场3");
        assertThat(after.get("sortOrder").asInt()).isEqualTo(3);
    }

    @Test
    void maintenanceToDisabledIsImpactCheckedButReopeningIsNot() throws Exception {
        jdbc.update("update resource set operational_status = 'MAINTENANCE' where id = ?", court2);
        long booked = reservation(zhangsan, court2, TOMORROW, "08:00");

        assertError(asSys(HttpMethod.PATCH, URL, body("operationalStatus", "DISABLED"), court2),
                ErrorCode.IMPACT_CONFIRMATION_REQUIRED);
        MvcResult reopened = asSys(HttpMethod.PATCH, URL, body("operationalStatus", "OPEN"), court2);

        assertThat(reopened.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(reopened).get("impact").get("affectedCount").asInt()).isZero();
        assertThat(reservationStatus(booked)).isEqualTo("CONFIRMED");
        assertThat(onlyLog().get("action")).isEqualTo("RESOURCE_STATUS_CHANGE");
    }

    @Test
    void onlyReservationsOfThatResourceAreAffected() throws Exception {
        long mine = reservation(zhangsan, court2, TOMORROW, "08:00");
        reservation(lisi, court1, TOMORROW, "08:00");

        JsonNode impact = json(asSys(HttpMethod.PATCH, URL, body("operationalStatus", "MAINTENANCE", "dryRun", true),
                court2)).get("impact");

        assertThat(briefIds(impact)).containsExactly(mine);
    }

    @Test
    void duplicateNameWithinVenueIsValidationError() throws Exception {
        JsonNode error = assertError(asSys(HttpMethod.PATCH, URL, body("name", "网球场1"), court2),
                ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").get("name").asText()).isEqualTo("同一场馆内场地名不能重复");
        assertThat(resourceRow(court2).get("name")).isEqualTo("网球场2");
        assertThat(asSys(HttpMethod.PATCH, URL, body("name", "网球场2"), court2).getResponse().getStatus())
                .isEqualTo(200);
        assertThat(asSys(HttpMethod.PATCH, URL, body("name", "羽毛球场1"), court2).getResponse().getStatus())
                .isEqualTo(200);
    }

    @Test
    void fieldFormatsAreChecked() throws Exception {
        JsonNode error = assertError(asSys(HttpMethod.PATCH, URL,
                body("name", "", "sortOrder", -1, "operationalStatus", "BROKEN"), court2), ErrorCode.VALIDATION_ERROR);

        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.get("name").asText()).isEqualTo("不能为空");
        assertThat(fields.get("sortOrder").asText()).isEqualTo("应为不小于 0 的整数");
        assertThat(fields.get("operationalStatus").asText()).isEqualTo("须为 OPEN、MAINTENANCE 或 DISABLED");
        assertError(asSys(HttpMethod.PATCH, URL, body("sortOrder", 1.5), court2), ErrorCode.VALIDATION_ERROR);
    }

    @Test
    void notFoundScopeAndRoleAreChecked() throws Exception {
        assertError(asSys(HttpMethod.PATCH, URL, body("name", "x"), 9999), ErrorCode.NOT_FOUND);
        JsonNode error = assertError(asTennisAdmin(HttpMethod.PATCH, URL, body("name", "x"), badmintonCourt),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(send(HttpMethod.PATCH, URL, body("name", "x"), zhangsan, Role.USER, court1), ErrorCode.FORBIDDEN);
        assertThat(resourceRow(badmintonCourt).get("name")).isEqualTo("羽毛球场1");
    }
}
