package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * BE-5 K1（BE-2b 第 10 节、审计 N4）：已有场地的 sortOrder 为 int 上限时追加场地，新场地的 sortOrder 超出 int 范围
 * → 400 VALIDATION_ERROR fields.count“排序值已达上限，无法追加场地”；dryRun 与执行都不写库、不写日志（合法输入不得 500）。
 */
class ResourceCountSortOrderLimitTest extends ImpactApiTestBase {

    private static final String URL = "/api/v1/admin/venues/{id}/resource-count";
    private static final String PATCH_URL = "/api/v1/admin/resources/{id}";

    private List<Map<String, Object>> resourceRows() {
        return jdbc.queryForList("select id, name, sort_order, operational_status, updated_at from resource"
                + " where venue_id = ? order by id", tennis);
    }

    private void assertSortOrderExhausted(JsonNode body) {
        assertThat(body.get("details").get("fields"))
                .isEqualTo(objectMapper.valueToTree(Map.of("count", "排序值已达上限，无法追加场地")));
    }

    @Test
    @DisplayName("K1 sortOrder 已达 int 上限时追加场地：dryRun 与执行均 400 fields.count，不写库、不写日志")
    void appendingBeyondTheIntSortOrderIsAValidationError() throws Exception {
        assertThat(asSys(HttpMethod.PATCH, PATCH_URL, body("sortOrder", Integer.MAX_VALUE), court4)
                .getResponse().getStatus()).isEqualTo(200);
        jdbc.update("delete from admin_operation_log");
        List<Map<String, Object>> before = resourceRows();

        assertSortOrderExhausted(assertError(asSys(HttpMethod.PUT, URL, body("count", 5, "dryRun", true), tennis),
                ErrorCode.VALIDATION_ERROR));
        assertSortOrderExhausted(assertError(asSys(HttpMethod.PUT, URL, body("count", 5), tennis),
                ErrorCode.VALIDATION_ERROR));

        assertThat(resourceRows()).isEqualTo(before);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("K1 边界：最大 sortOrder 为 int 上限 − 1 时恰好可以再追加 1 个场地，追加 2 个则报错")
    void theLastIntSortOrderCanStillBeUsed() throws Exception {
        jdbc.update("update resource set sort_order = ? where id = ?", Integer.MAX_VALUE - 1, court4);

        assertSortOrderExhausted(assertError(asSys(HttpMethod.PUT, URL, body("count", 6), tennis),
                ErrorCode.VALIDATION_ERROR));
        assertThat(asSys(HttpMethod.PUT, URL, body("count", 5), tennis).getResponse().getStatus()).isEqualTo(200);

        assertThat(jdbc.queryForObject("select sort_order from resource where venue_id = ? and name = '网球场5'",
                Integer.class, tennis)).isEqualTo(Integer.MAX_VALUE);
    }
}
