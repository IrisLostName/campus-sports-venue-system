package com.campus.venue.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.probe.SecuredProbeController;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.TokenService;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 接口集成测试基类：真实 PostgreSQL 测试库 + MockMvc（含安全过滤器链）+ 可调时钟。
 * 每个测试前清库并把时钟重置为 MutableClock.START，结果不依赖执行顺序。
 */
@IntegrationTest
@AutoConfigureMockMvc
@Import({MutableClockConfig.class, SecuredProbeController.class})
public abstract class AbstractApiTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected MutableClock clock;

    @Autowired
    protected TokenService tokenService;

    @Autowired
    private DataSource dataSource;

    @BeforeEach
    void resetDatabaseAndClock() {
        DatabaseCleaner.truncateAll(dataSource);
        clock.reset();
    }

    protected long user(String username, Role role) {
        return TestUsers.insert(jdbc, username, role);
    }

    protected String bearer(long userId, Role role) {
        return TestUsers.bearer(tokenService, userId, role);
    }

    protected JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /** 断言 ErrorBody：状态、JSON 类型、code、默认文案，且不带 WWW-Authenticate。 */
    protected JsonNode assertError(MvcResult result, ErrorCode code) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(code.getStatus().value());
        assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(result.getResponse().getHeader(HttpHeaders.WWW_AUTHENTICATE)).isNull();
        JsonNode body = json(result);
        assertThat(body.get("code").asText()).isEqualTo(code.name());
        assertThat(body.get("message").asText()).isEqualTo(code.getDefaultMessage());
        return body;
    }
}
