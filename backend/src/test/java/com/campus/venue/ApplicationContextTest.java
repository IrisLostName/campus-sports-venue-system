package com.campus.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.security.TokenService;
import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.metamodel.EntityType;
import java.util.Set;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.Location;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.HealthContributorRegistry;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** 应用上下文在 validate 下能启动、结构只来自 Flyway、健康检查只暴露 health（H1）。 */
@IntegrationTest
@AutoConfigureMockMvc
class ApplicationContextTest {

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private Flyway flyway;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private HealthContributorRegistry healthRegistry;

    @Autowired
    private TokenService tokenService;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    /** BE-1 起非公开路径都需登录：每个用例前清库、造一个测试用户并携带其有效令牌（BE-1 裁决第 11 节第 2 条）。 */
    private String bearer;

    @BeforeEach
    void authenticate() {
        DatabaseCleaner.truncateAll(dataSource);
        bearer = TestUsers.bearer(tokenService, TestUsers.insert(jdbc, "probe_user", Role.USER), Role.USER);
    }

    @Test
    void hibernateValidatesTheSchemaAndManagesAllTenTables() {
        assertThat(entityManagerFactory.getProperties()).containsEntry("hibernate.hbm2ddl.auto", "validate");

        Set<String> entities = entityManagerFactory.getMetamodel().getEntities().stream()
                .map(EntityType::getName).collect(Collectors.toSet());

        assertThat(entities).containsExactlyInAnyOrder("AppUser", "Venue", "Resource", "AvailabilityRule",
                "Reservation", "UsageRecord", "Announcement", "RepairReport", "AdminVenueScope",
                "AdminOperationLog");
    }

    @Test
    void testRunsOnlyTheStructureMigrationLocation() {
        assertThat(flyway.getConfiguration().getLocations()).extracting(Location::getPath)
                .containsExactly("db/migration");
    }

    @Test
    void healthEndpointReportsUpWithoutDetails() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator/health")).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("status").asText()).isEqualTo("UP");
        assertThat(body.size()).isEqualTo(1);
    }

    @Test
    void healthIncludesTheDatabaseCheck() {
        assertThat(healthRegistry.getContributor("db")).isNotNull();
    }

    @Test
    void otherActuatorEndpointsAreNotExposed() throws Exception {
        for (String path : new String[] {"/actuator/info", "/actuator/env", "/actuator/beans", "/actuator/shutdown"}) {
            MvcResult result = mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

            assertThat(result.getResponse().getStatus()).as(path).isEqualTo(404);
            assertThat(objectMapper.readTree(result.getResponse().getContentAsString()).get("code").asText())
                    .as(path).isEqualTo("NOT_FOUND");
        }
    }

    @Test
    void actuatorDiscoveryPageIsNotExposed() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(404);
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(body.get("message").asText()).isEqualTo("资源不存在");

        MvcResult health = mockMvc.perform(get("/actuator/health")).andReturn();

        assertThat(health.getResponse().getStatus()).isEqualTo(200);
        assertThat(objectMapper.readTree(health.getResponse().getContentAsString()).get("status").asText())
                .isEqualTo("UP");
    }

    @Test
    void unknownBusinessPathReturnsNotFoundErrorBody() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/does-not-exist").header(HttpHeaders.AUTHORIZATION, bearer))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(404);
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(body.get("message").asText()).isEqualTo("资源不存在");
    }

    /** P5：认证先于路由，未登录访问不存在的非公开路径或未暴露的 actuator 端点得到 AUTH_REQUIRED（API-SYNC 观察项）。 */
    @Test
    void nonPublicPathsWithoutTokenRequireAuthentication() throws Exception {
        for (String path : new String[] {"/api/v1/does-not-exist", "/actuator", "/actuator/info", "/actuator/env"}) {
            MvcResult result = mockMvc.perform(get(path)).andReturn();

            assertThat(result.getResponse().getStatus()).as(path).isEqualTo(401);
            assertThat(objectMapper.readTree(result.getResponse().getContentAsString()).get("code").asText())
                    .as(path).isEqualTo("AUTH_REQUIRED");
        }
    }
}
