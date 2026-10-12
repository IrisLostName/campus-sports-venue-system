package com.campus.venue.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MvcResult;

/**
 * T4：用演示种子数据（db/demo/V100__demo_seed.sql，清库后执行，id 与 docs/13 第 5 节一致）做端到端用例。
 * 下一个测试类开始前基类会清库，测试库恢复为只有表结构的状态。
 */
class SeedScenarioTest extends AbstractApiTest {

    private static final LocalDate TOMORROW = MutableClock.START.toLocalDate().plusDays(1);
    private static final long ZHANGSAN = 1;
    private static final long ADMIN_TENNIS = 5;
    private static final long ADMIN_POOL = 6;

    @Autowired
    private DataSource dataSource;

    @BeforeEach
    void loadDemoSeed() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/demo/V100__demo_seed.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }

    private MvcResult call(String path, long userId, Role role) throws Exception {
        return mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer(userId, role))).andReturn();
    }

    @Test
    void tennisHasFourCourtsWithEightSlotsEachTomorrow() throws Exception {
        MvcResult result = call("/api/v1/venues/1/slots?date=" + TOMORROW, ZHANGSAN, Role.USER);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(body.get("resources").findValuesAsText("resourceName"))
                .containsExactly("网球场1", "网球场2", "网球场3", "网球场4");
        for (JsonNode resource : body.get("resources")) {
            assertThat(resource.get("slots").findValuesAsText("startTime")).containsExactly(
                    "08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30");
            assertThat(resource.get("slots").get(7).get("endTime").asText()).isEqualTo("20:00");
            assertThat(resource.get("slots").findValuesAsText("status")).containsOnly("AVAILABLE");
        }
    }

    @Test
    void userListShowsOnlyTennisAsBookable() throws Exception {
        JsonNode body = json(call("/api/v1/venues", ZHANGSAN, Role.USER));

        assertThat(body.findValuesAsText("bookable")).containsExactly("true", "false", "false");
        assertThat(body.findValuesAsText("resourceCount")).containsExactly("4", "6", "6");
    }

    @Test
    void badmintonSlotsAreNotBookable() throws Exception {
        assertError(call("/api/v1/venues/2/slots?date=" + TOMORROW, ZHANGSAN, Role.USER),
                ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    void poolAdminManagesBadmintonAndPoolOnly() throws Exception {
        JsonNode body = json(call("/api/v1/admin/venues", ADMIN_POOL, Role.VENUE_ADMIN));

        assertThat(body.findValuesAsText("id")).isEqualTo(List.of("2", "3"));
    }

    @Test
    void tennisAdminCannotReadBadmintonResources() throws Exception {
        JsonNode body = assertError(call("/api/v1/admin/venues/2/resources", ADMIN_TENNIS, Role.VENUE_ADMIN),
                ErrorCode.FORBIDDEN_SCOPE);

        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(2);
    }
}
