package com.campus.venue.availability;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-2b A4、T3、T5、T7（BE-2a N1）：整体替换每周窗口。字段问题一次报告全部；RULE_INVALID 不改数据不写日志；
 * 原 ACTIVE 规则置 INACTIVE、插入新规则；影响范围为开始时间不再是新窗口时段的预约。明天（2026-10-13）是周二。
 */
class WeeklyRulesApiTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/venues/{id}/availability-rules/weekly";

    private static Map<String, Object> window(int weekday, String open, String close) {
        return body("weekday", weekday, "openTime", open, "closeTime", close);
    }

    private MvcResult replace(Object... windows) throws Exception {
        return asSys(HttpMethod.PUT, URL, body("windows", Arrays.asList(windows)), tennis);
    }

    private int weeklyCount(String status) {
        return jdbc.queryForObject("select count(*) from availability_rule where venue_id = ? and rule_type = 'WEEKLY'"
                + " and status = ?", Integer.class, tennis, status);
    }

    @Test
    void allWindowFieldProblemsAreReportedAtOnce() throws Exception {
        MvcResult result = replace(window(0, "8:00", "24:00"), window(8, "08:00", "20:61"), null);

        JsonNode fields = assertError(result, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("windows[0].weekday").asText()).isEqualTo("应为 1–7 的整数");
        assertThat(fields.get("windows[0].openTime").asText()).isEqualTo("时刻格式应为 HH:mm");
        assertThat(fields.get("windows[0].closeTime").asText()).isEqualTo("时刻格式应为 HH:mm");
        assertThat(fields.get("windows[1].weekday").asText()).isEqualTo("应为 1–7 的整数");
        assertThat(fields.get("windows[1].closeTime").asText()).isEqualTo("时刻格式应为 HH:mm");
        assertThat(fields.get("windows[2]").asText()).isEqualTo("必填");
        assertThat(fields.size()).isEqualTo(6);
        assertThat(weeklyCount("ACTIVE")).isEqualTo(7);
    }

    @Test
    void windowsIsRequired() throws Exception {
        JsonNode fields = assertError(asSys(HttpMethod.PUT, URL, body(), tennis), ErrorCode.VALIDATION_ERROR)
                .get("details").get("fields");
        assertThat(fields.get("windows").asText()).isEqualTo("必填");
        JsonNode missing = assertError(replace(body("weekday", 1)), ErrorCode.VALIDATION_ERROR)
                .get("details").get("fields");
        assertThat(missing.get("windows[0].openTime").asText()).isEqualTo("必填");
        assertThat(missing.get("windows[0].closeTime").asText()).isEqualTo("必填");
    }

    @Test
    void invalidRulesAreRuleInvalidAndChangeNothing() throws Exception {
        String[][] cases = {
            {"08:00", "20:30", "窗口长度必须是 90 分钟的整数倍"},
            {"10:00", "08:30", "开始时间不早于结束时间"},
        };
        for (String[] item : cases) {
            JsonNode error = assertError(replace(window(1, item[0], item[1])), ErrorCode.RULE_INVALID);
            assertThat(error.get("details").get("reason").asText()).isEqualTo(item[2]);
        }
        JsonNode overlap = assertError(replace(window(2, "08:00", "11:00"), window(2, "09:30", "11:00")),
                ErrorCode.RULE_INVALID);
        assertThat(overlap.get("details").get("reason").asText()).isEqualTo("同一星期的窗口不能重叠");
        assertThat(weeklyCount("ACTIVE")).isEqualTo(7);
        assertThat(weeklyCount("INACTIVE")).isZero();
        assertThat(logCount()).isZero();
    }

    @Test
    void replacementDeactivatesOldRulesAndReturnsSortedWindows() throws Exception {
        MvcResult result = asTennisAdmin(HttpMethod.PUT, URL, body("windows", List.of(window(3, "09:00", "10:30"),
                window(1, "14:00", "17:00"), window(1, "08:00", "11:00"))), tennis);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode data = json(result).get("data");
        assertThat(data).hasSize(3);
        assertThat(data.get(0).get("weekday").asInt()).isEqualTo(1);
        assertThat(data.get(0).get("openTime").asText()).isEqualTo("08:00");
        assertThat(data.get(0).get("closeTime").asText()).isEqualTo("11:00");
        assertThat(data.get(1).get("openTime").asText()).isEqualTo("14:00");
        assertThat(data.get(2).get("weekday").asInt()).isEqualTo(3);
        assertThat(data.get(0).get("id").asLong()).isPositive();
        assertThat(weeklyCount("ACTIVE")).isEqualTo(3);
        assertThat(weeklyCount("INACTIVE")).isEqualTo(7);
        Map<String, Object> created = jdbc.queryForMap("select * from availability_rule where id = ?",
                data.get(0).get("id").asLong());
        assertThat(created.get("created_by")).isEqualTo(tennisAdmin);
        assertThat(created.get("created_at")).isEqualTo(Timestamp.valueOf(NOW));
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RULE_WEEKLY_UPDATE");
        assertThat(log.get("target_type")).isEqualTo("RULE");
        assertThat(log.get("target_id")).isNull();
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(snapshot(log, "before_snapshot").get("object")).hasSize(7);
        assertThat(snapshot(log, "after_snapshot").get("object")).hasSize(3);
    }

    @Test
    void emptyWindowsCloseEveryDay() throws Exception {
        JsonNode response = json(replace());

        assertThat(response.get("data")).isEmpty();
        assertThat(weeklyCount("ACTIVE")).isZero();
    }

    @Test
    void reservationsStillOnNewSlotsAreNotAffected() throws Exception {
        long kept = reservation(zhangsan, court1, TOMORROW, "08:00");
        long dropped = reservation(zhangsan, court1, TOMORROW, "17:00");
        long misaligned = reservation(lisi, court2, TOMORROW, "09:30");
        long otherDay = reservation(lisi, court3, TOMORROW.plusDays(1), "08:00");

        JsonNode impact = json(asSys(HttpMethod.PUT, URL, body("windows", List.of(window(2, "08:00", "09:30"),
                window(2, "11:30", "14:30")), "dryRun", true), tennis)).get("impact");

        assertThat(briefIds(impact)).containsExactly(dropped, misaligned, otherDay);
        assertThat(briefIds(impact)).doesNotContain(kept);
        assertThat(weeklyCount("ACTIVE")).isEqualTo(7);
    }

    @Test
    void scopeAndNotFoundComeBeforeRuleValidation() throws Exception {
        Map<String, Object> invalid = body("windows", List.of(window(1, "08:00", "20:30")));
        assertError(asTennisAdmin(HttpMethod.PUT, URL, invalid, badminton), ErrorCode.FORBIDDEN_SCOPE);
        assertError(asSys(HttpMethod.PUT, URL, invalid, 9999), ErrorCode.NOT_FOUND);
        assertError(send(HttpMethod.PUT, URL, body("windows", List.of()), zhangsan, Role.USER, tennis),
                ErrorCode.FORBIDDEN);
        assertThat(weeklyCount("ACTIVE")).isEqualTo(7);
    }
}
