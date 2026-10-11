package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.TestDatabaseGuard;
import com.fasterxml.jackson.databind.JsonNode;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/**
 * T5：在测试库上追加 db/demo 种子（沿用 BE-0 T3 的方式），用演示账号端到端登录并取 /auth/me；
 * 结束后清库恢复为只有 db/migration 的状态。
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DemoAccountsTest extends AbstractApiTest {

    private static final String DEMO_PASSWORD = "Demo@1234";

    @Autowired
    private DataSource dataSource;

    private Flyway flyway(String... locations) {
        return Flyway.configure().dataSource(dataSource).locations(locations).cleanDisabled(false).load();
    }

    @BeforeEach
    void migrateWithSeed() {
        TestDatabaseGuard.require(dataSource);
        Flyway flyway = flyway("classpath:db/migration", "classpath:db/demo");
        flyway.clean();
        flyway.migrate();
    }

    @AfterAll
    void restoreStructureOnly() {
        TestDatabaseGuard.require(dataSource);
        Flyway flyway = flyway("classpath:db/migration");
        flyway.clean();
        flyway.migrate();
        assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isZero();
    }

    private JsonNode loginAndMe(String username) throws Exception {
        String body = "{\"username\":\"" + username + "\",\"password\":\"" + DEMO_PASSWORD + "\"}";
        JsonNode login = json(mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(body)).andReturn());
        JsonNode me = json(mockMvc.perform(get("/api/v1/auth/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + login.get("token").asText())).andReturn());
        assertThat(me).isEqualTo(login.get("user"));
        return me;
    }

    @Test
    void zhangsanIsAUserWithoutVenueIds() throws Exception {
        JsonNode me = loginAndMe("zhangsan");

        assertThat(me.get("id").asLong()).isEqualTo(1L);
        assertThat(me.get("displayName").asText()).isEqualTo("张三");
        assertThat(me.get("role").asText()).isEqualTo("USER");
        assertThat(me.get("userType").asText()).isEqualTo("STUDENT");
        assertThat(me.get("venueIds").isNull()).isTrue();
    }

    @Test
    void adminPoolManagesBadmintonAndPool() throws Exception {
        JsonNode me = loginAndMe("admin_pool");

        assertThat(me.get("role").asText()).isEqualTo("VENUE_ADMIN");
        assertThat(me.get("venueIds")).extracting(JsonNode::asLong).containsExactly(2L, 3L);
    }

    @Test
    void adminTennisManagesTennis() throws Exception {
        assertThat(loginAndMe("admin_tennis").get("venueIds")).extracting(JsonNode::asLong).containsExactly(1L);
    }

    @Test
    void sysadminHasNullVenueIds() throws Exception {
        JsonNode me = loginAndMe("sysadmin");

        assertThat(me.get("role").asText()).isEqualTo("SYS_ADMIN");
        assertThat(me.get("venueIds").isNull()).isTrue();
    }
}
