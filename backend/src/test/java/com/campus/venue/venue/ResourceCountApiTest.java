package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-08：设定场地数量（docs/09 第 3 节，BE-2b 裁决 A3、T4）。缩小时编号最大的先停用；增大时先按编号从小到大
 * 重新启用停用的场地，再追加“前缀N”；前缀与类型缺省；空场馆缺省报错；不规则名称排在最后；count 0、50 边界与越界；
 * 追加名称不冲突；每次实际执行写 RESOURCE_COUNT_CHANGE（目标为场馆）。
 */
class ResourceCountApiTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/venues/{id}/resource-count";

    private MvcResult setCount(long venueId, Map<String, Object> request) throws Exception {
        return asSys(HttpMethod.PUT, URL, request, venueId);
    }

    private JsonNode data(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json(result).get("data");
    }

    private static List<String> names(JsonNode data, String status) {
        List<String> list = new ArrayList<>();
        data.forEach(resource -> {
            if (status == null || status.equals(resource.get("operationalStatus").asText())) {
                list.add(resource.get("name").asText());
            }
        });
        return list;
    }

    private Timestamp updatedAt(long resourceId) {
        return jdbc.queryForObject("select updated_at from resource where id = ?", Timestamp.class, resourceId);
    }

    @Test
    void shrinkingDisablesHighestNumberedResources() throws Exception {
        clock.advance(Duration.ofMinutes(3));

        JsonNode data = data(asTennisAdmin(HttpMethod.PUT, URL, body("count", 2), tennis));

        assertThat(names(data, null)).containsExactly("网球场1", "网球场2", "网球场3", "网球场4");
        assertThat(names(data, "DISABLED")).containsExactly("网球场3", "网球场4");
        assertThat(updatedAt(court4)).isEqualTo(Timestamp.valueOf(NOW.plusMinutes(3)));
        assertThat(updatedAt(court1)).isNotEqualTo(Timestamp.valueOf(NOW.plusMinutes(3)));
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("RESOURCE_COUNT_CHANGE");
        assertThat(log.get("target_type")).isEqualTo("VENUE");
        assertThat(log.get("target_id")).isEqualTo(tennis);
        assertThat(log.get("venue_id")).isEqualTo(tennis);
        assertThat(names(snapshot(log, "before_snapshot").get("object"), "OPEN")).hasSize(4);
        assertThat(names(snapshot(log, "after_snapshot").get("object"), "DISABLED"))
                .containsExactly("网球场3", "网球场4");
    }

    @Test
    void growingReenablesLowestNumberedDisabledFirst() throws Exception {
        jdbc.update("update resource set operational_status = 'DISABLED' where id in (?, ?)", court2, court4);

        JsonNode data = data(setCount(tennis, body("count", 3)));

        assertThat(names(data, "OPEN")).containsExactly("网球场1", "网球场2", "网球场3");
        assertThat(names(data, "DISABLED")).containsExactly("网球场4");
        assertThat(updatedAt(court2)).isEqualTo(Timestamp.valueOf(NOW));
    }

    @Test
    void growingBeyondDisabledAppendsWithDefaultPrefixAndType() throws Exception {
        jdbc.update("update resource set operational_status = 'DISABLED' where id = ?", court4);

        JsonNode data = data(setCount(tennis, body("count", 6)));

        assertThat(names(data, "OPEN")).containsExactly("网球场1", "网球场2", "网球场3", "网球场4", "网球场5", "网球场6");
        JsonNode sixth = data.get(5);
        assertThat(sixth.get("sortOrder").asInt()).isEqualTo(6);
        assertThat(sixth.get("resourceType").asText()).isEqualTo("COURT");
        assertThat(sixth.get("venueId").asLong()).isEqualTo(tennis);
        Map<String, Object> row = jdbc.queryForMap("select * from resource where id = ?", sixth.get("id").asLong());
        assertThat(row.get("created_at")).isEqualTo(Timestamp.valueOf(NOW));
        assertThat(row.get("updated_at")).isEqualTo(Timestamp.valueOf(NOW));
    }

    @Test
    void explicitPrefixAndTypeAreUsed() throws Exception {
        JsonNode data = data(setCount(tennis, body("count", 6, "namePrefix", "训练场", "resourceType", "OTHER")));

        assertThat(names(data, null)).endsWith("训练场1", "训练场2");
        assertThat(data.get(5).get("resourceType").asText()).isEqualTo("OTHER");
        assertThat(data.get(5).get("sortOrder").asInt()).isEqualTo(6);
    }

    @Test
    void defaultPrefixAndTypeComeFromFirstResourceBySortOrder() throws Exception {
        long pool = fixtures.venue("游泳馆", false, "OPEN");
        jdbc.update("insert into resource (venue_id, name, resource_type, sort_order) values (?, '泳道3', 'LANE', 2),"
                + " (?, '深水道', 'OTHER', 5)", pool, pool);

        JsonNode data = data(setCount(pool, body("count", 3)));

        assertThat(names(data, null)).containsExactly("泳道3", "深水道", "泳道4");
        assertThat(data.get(2).get("resourceType").asText()).isEqualTo("LANE");
        assertThat(data.get(2).get("sortOrder").asInt()).isEqualTo(6);
    }

    @Test
    void emptyVenueWithoutDefaultsIsValidationError() throws Exception {
        long empty = fixtures.venue("篮球馆", false, "OPEN");

        JsonNode fields = assertError(setCount(empty, body("count", 2)), ErrorCode.VALIDATION_ERROR)
                .get("details").get("fields");
        assertThat(fields.get("namePrefix").asText()).isEqualTo("场馆没有场地时必须提供");
        assertThat(fields.get("resourceType").asText()).isEqualTo("场馆没有场地时必须提供");
        JsonNode onlyType = assertError(setCount(empty, body("count", 2, "namePrefix", "篮球场", "dryRun", true)),
                ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(onlyType.has("namePrefix")).isFalse();
        assertThat(onlyType.get("resourceType").asText()).isEqualTo("场馆没有场地时必须提供");
        assertThat(data(setCount(empty, body("count", 0)))).isEmpty();
        assertThat(names(data(setCount(empty, body("count", 2, "namePrefix", "篮球场", "resourceType", "COURT"))), null))
                .containsExactly("篮球场1", "篮球场2");
    }

    @Test
    void irregularNamesSortLastSoTheyAreDisabledFirstAndReenabledLast() throws Exception {
        long centre = fixtures.resource(tennis, "中心场", 0, "OPEN");

        assertThat(names(data(setCount(tennis, body("count", 4))), "DISABLED")).containsExactly("中心场");
        assertThat(names(data(setCount(tennis, body("count", 3))), "DISABLED")).containsExactly("中心场", "网球场4");
        assertThat(names(data(setCount(tennis, body("count", 4))), "DISABLED")).containsExactly("中心场");
        assertThat(resourceStatus(centre)).isEqualTo("DISABLED");
    }

    @Test
    void countBoundaries() throws Exception {
        assertThat(names(data(setCount(tennis, body("count", 0))), "OPEN")).isEmpty();
        JsonNode fifty = data(setCount(tennis, body("count", 50)));
        assertThat(names(fifty, "OPEN")).hasSize(50).contains("网球场50");
        for (Object bad : new Object[] {-1, 51}) {
            JsonNode error = assertError(setCount(tennis, body("count", bad)), ErrorCode.VALIDATION_ERROR);
            assertThat(error.get("details").get("fields").get("count").asText()).isEqualTo("应为 0–50 的整数");
        }
        assertThat(assertError(setCount(tennis, body()), ErrorCode.VALIDATION_ERROR)
                .get("details").get("fields").get("count").asText()).isEqualTo("必填");
        assertError(setCount(tennis, body("count", 1.5)), ErrorCode.VALIDATION_ERROR);
        JsonNode fields = assertError(setCount(tennis, body("count", 5, "namePrefix", " ", "resourceType", "POOL")),
                ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("namePrefix").asText()).isEqualTo("不能为空");
        assertThat(fields.get("resourceType").asText()).isEqualTo("须为 COURT、LANE 或 OTHER");
        assertThat(assertError(setCount(tennis, body("count", 5, "namePrefix", "x".repeat(41))),
                ErrorCode.VALIDATION_ERROR).get("details").get("fields").get("namePrefix").asText())
                .isEqualTo("不能超过 40 个字符");
    }

    @Test
    void appendedNamesDoNotClashWithExistingNumbers() throws Exception {
        fixtures.resource(tennis, "网球场010", 5, "OPEN");
        fixtures.resource(tennis, "网球场A", 6, "OPEN");

        JsonNode data = data(setCount(tennis, body("count", 7)));

        assertThat(names(data, null)).endsWith("网球场11");
    }

    @Test
    void generatedNameLongerThan50IsValidationError() throws Exception {
        long venue = fixtures.venue("长名馆", false, "OPEN");
        fixtures.resource(venue, "长".repeat(49) + "9", 1, "OPEN");

        JsonNode error = assertError(setCount(venue, body("count", 2)), ErrorCode.VALIDATION_ERROR);

        assertThat(error.get("details").get("fields").get("namePrefix").asText()).isEqualTo("生成的场地名超过 50 个字符");
    }

    @Test
    void unchangedCountStillLogs() throws Exception {
        JsonNode response = json(setCount(tennis, body("count", 4)));

        assertThat(response.get("applied").asBoolean()).isTrue();
        assertThat(names(response.get("data"), "OPEN")).hasSize(4);
        assertThat(onlyLog().get("action")).isEqualTo("RESOURCE_COUNT_CHANGE");
    }

    @Test
    void notFoundScopeAndRoleAreChecked() throws Exception {
        assertError(setCount(9999, body("count", 1)), ErrorCode.NOT_FOUND);
        assertError(asTennisAdmin(HttpMethod.PUT, URL, body("count", 0), badminton), ErrorCode.FORBIDDEN_SCOPE);
        assertError(send(HttpMethod.PUT, URL, body("count", 0), zhangsan, Role.USER, tennis), ErrorCode.FORBIDDEN);
        assertThat(resourceStatus(badmintonCourt)).isEqualTo("OPEN");
        assertThat(logCount()).isZero();
    }
}
