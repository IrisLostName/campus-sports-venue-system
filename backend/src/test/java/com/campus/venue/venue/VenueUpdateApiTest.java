package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-2b A1、T3、T5、T6：PATCH /admin/venues/{id}。VA 只能改 description；SA 可改全部；场馆重名；
 * 只有 OPEN 改为 CLOSED 才做影响检查；每次实际执行写 VENUE_UPDATE；updated_at 取 Clock。
 */
class VenueUpdateApiTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/venues/{id}";

    private Map<String, Object> venueRow(long id) {
        return jdbc.queryForMap("select * from venue where id = ?", id);
    }

    @Test
    void venueAdminUpdatesDescriptionOfOwnVenue() throws Exception {
        clock.advance(Duration.ofMinutes(5));

        MvcResult result = asTennisAdmin(HttpMethod.PATCH, URL, body("description", "新的简介"), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode data = json(result).get("data");
        assertThat(data.get("description").asText()).isEqualTo("新的简介");
        assertThat(data.get("name").asText()).isEqualTo("网球馆");
        assertThat(data.get("resourceCount").asInt()).isEqualTo(4);
        Map<String, Object> row = venueRow(tennis);
        assertThat(row.get("description")).isEqualTo("新的简介");
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW.plusMinutes(5)));
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("VENUE_UPDATE");
        assertThat(log.get("target_type")).isEqualTo("VENUE");
        assertThat(log.get("target_id")).isEqualTo(tennis);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(snapshot(log, "before_snapshot").get("object").get("description").isNull()).isTrue();
        assertThat(snapshot(log, "after_snapshot").get("object").get("description").asText()).isEqualTo("新的简介");
    }

    @Test
    void venueAdminSubmittingSysAdminFieldsIsForbiddenBeforeNotFound() throws Exception {
        for (Map<String, Object> request : List.of(body("name", "改名"), body("venueType", "OTHER"),
                body("location", "东区"), body("operationalStatus", "CLOSED"), body("userBookingEnabled", false),
                body("description", "x", "userBookingEnabled", true))) {
            assertError(asTennisAdmin(HttpMethod.PATCH, URL, request, tennis), ErrorCode.FORBIDDEN);
            assertError(asTennisAdmin(HttpMethod.PATCH, URL, request, 9999), ErrorCode.FORBIDDEN);
        }
        assertThat(venueRow(tennis).get("user_booking_enabled")).isEqualTo(true);
        assertThat(logCount()).isZero();
    }

    @Test
    void explicitNullSysAdminFieldsAreNotSubmissions() throws Exception {
        MvcResult result = asTennisAdmin(HttpMethod.PATCH, URL,
                body("name", null, "userBookingEnabled", null, "description", "简介"), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(venueRow(tennis).get("name")).isEqualTo("网球馆");
    }

    @Test
    void venueAdminOutsideScopeAndUserAreRejected() throws Exception {
        JsonNode error = assertError(asTennisAdmin(HttpMethod.PATCH, URL, body("description", "x"), badminton),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(error.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertError(send(HttpMethod.PATCH, URL, body("description", "x"), zhangsan, Role.USER, tennis),
                ErrorCode.FORBIDDEN);
        assertError(asSys(HttpMethod.PATCH, URL, body("description", "x"), 9999), ErrorCode.NOT_FOUND);
        assertThat(logCount()).isZero();
    }

    @Test
    void sysAdminUpdatesAllFields() throws Exception {
        MvcResult result = asSys(HttpMethod.PATCH, URL, body("name", "新网球馆", "venueType", "OTHER",
                "location", "东区", "description", "简介", "userBookingEnabled", false), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode data = json(result).get("data");
        assertThat(data.get("name").asText()).isEqualTo("新网球馆");
        assertThat(data.get("venueType").asText()).isEqualTo("OTHER");
        assertThat(data.get("location").asText()).isEqualTo("东区");
        assertThat(data.get("userBookingEnabled").asBoolean()).isFalse();
        assertThat(data.get("bookable").asBoolean()).isFalse();
        assertThat(venueRow(tennis).get("name")).isEqualTo("新网球馆");
        assertThat(onlyLog().get("action")).isEqualTo("VENUE_UPDATE");
    }

    @Test
    void duplicateVenueNameIsValidationError() throws Exception {
        JsonNode error = assertError(asSys(HttpMethod.PATCH, URL, body("name", "羽毛球馆"), tennis),
                ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").get("name").asText()).isEqualTo("场馆名已存在");
        assertThat(venueRow(tennis).get("name")).isEqualTo("网球馆");
        assertThat(logCount()).isZero();
        assertThat(asSys(HttpMethod.PATCH, URL, body("name", "网球馆"), tennis).getResponse().getStatus())
                .isEqualTo(200);
    }

    @Test
    void fieldFormatsAreCheckedTogether() throws Exception {
        JsonNode error = assertError(asSys(HttpMethod.PATCH, URL, body("name", "x".repeat(51), "venueType", "GOLF",
                "location", " ", "description", "x".repeat(501), "operationalStatus", "MAINTENANCE"), tennis),
                ErrorCode.VALIDATION_ERROR);

        JsonNode fields = error.get("details").get("fields");
        assertThat(fields.get("name").asText()).isEqualTo("不能超过 50 个字符");
        assertThat(fields.has("venueType")).isTrue();
        assertThat(fields.get("location").asText()).isEqualTo("不能为空");
        assertThat(fields.get("description").asText()).isEqualTo("不能超过 500 个字符");
        assertThat(fields.get("operationalStatus").asText()).isEqualTo("须为 OPEN 或 CLOSED");
    }

    @Test
    void userBookingEnabledChangeAndReclosingAreNotImpactChecked() throws Exception {
        long upcoming = reservation(zhangsan, court1, TOMORROW, "08:00");

        MvcResult toggled = asSys(HttpMethod.PATCH, URL, body("userBookingEnabled", false), tennis);
        assertThat(toggled.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(toggled).get("impact").get("affectedCount").asInt()).isZero();

        jdbc.update("update venue set operational_status = 'CLOSED' where id = ?", tennis);
        MvcResult reclosed = asSys(HttpMethod.PATCH, URL, body("operationalStatus", "CLOSED"), tennis);
        assertThat(reclosed.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(reclosed).get("impact").get("affectedCount").asInt()).isZero();
        assertThat(reservationStatus(upcoming)).isEqualTo("CONFIRMED");
        assertThat(logs()).hasSize(2).allMatch(log -> "VENUE_UPDATE".equals(log.get("action")));
    }

    @Test
    void closingVenueAffectsReservationsOnAllItsResources() throws Exception {
        long first = reservation(zhangsan, court1, TOMORROW, "08:00");
        long second = reservation(lisi, court3, TOMORROW.plusDays(2), "11:00");
        reservation(lisi, badmintonCourt, TOMORROW, "08:00");

        JsonNode impact = json(asSys(HttpMethod.PATCH, URL, body("operationalStatus", "CLOSED", "dryRun", true),
                tennis)).get("impact");

        assertThat(impact.get("affectedCount").asInt()).isEqualTo(2);
        assertThat(briefIds(impact)).containsExactly(first, second);
    }
}
