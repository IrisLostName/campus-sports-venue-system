package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.support.ImpactApiTestBase;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 K2（BE-2b 审计 N1）：两个请求同时把场馆（或同场馆的两个场地）改成同一名称，经完整的 HTTP 栈并发提交：
 * 恰好一个 200，另一个 400 VALIDATION_ERROR fields.name（唯一约束冲突 23505 + 约束名转换，不得 500），库中该名称恰 1 行。
 */
class RenameConcurrencyTest extends ImpactApiTestBase {

    private static final String VENUE_URL = "/api/v1/admin/venues/{id}";
    private static final String RESOURCE_URL = "/api/v1/admin/resources/{id}";

    private List<String> outcomes(List<MvcResult> results) throws Exception {
        List<String> list = new ArrayList<>();
        for (MvcResult result : results) {
            int status = result.getResponse().getStatus();
            list.add(status == 200 ? "200"
                    : status + " " + json(result).get("code").asText() + " " + json(result).get("details"));
        }
        return list;
    }

    private String fieldError(String message) {
        return "400 VALIDATION_ERROR " + objectMapper.valueToTree(Map.of("fields", Map.of("name", message)));
    }

    @Test
    @DisplayName("K2 两个场馆同时改成同一名称：恰好 1 个 200、1 个 fields.name“场馆名已存在”，库中该名称恰 1 行")
    void twoVenuesRenamedToOneNameConcurrently() throws Exception {
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (long venueId : List.of(tennis, badminton)) {
            tasks.add(() -> asSys(HttpMethod.PATCH, VENUE_URL, body("name", "综合馆"), venueId));
        }

        List<String> outcomes = outcomes(ConcurrentRequests.runTogether(tasks));

        assertThat(outcomes).containsExactlyInAnyOrder("200", fieldError("场馆名已存在"));
        assertThat(jdbc.queryForObject("select count(*) from venue where name = '综合馆'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("K2 同场馆两个场地同时改成同一名称：恰好 1 个 200、1 个 fields.name，库中该名称恰 1 行")
    void twoResourcesRenamedToOneNameConcurrently() throws Exception {
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (long resourceId : List.of(court1, court2)) {
            tasks.add(() -> asSys(HttpMethod.PATCH, RESOURCE_URL, body("name", "中心球场"), resourceId));
        }

        List<String> outcomes = outcomes(ConcurrentRequests.runTogether(tasks));

        assertThat(outcomes).containsExactlyInAnyOrder("200", fieldError("同一场馆内场地名不能重复"));
        assertThat(jdbc.queryForObject("select count(*) from resource where venue_id = ? and name = '中心球场'",
                Integer.class, tennis)).isEqualTo(1);
    }
}
