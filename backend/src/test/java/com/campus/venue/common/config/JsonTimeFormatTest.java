package com.campus.venue.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.probe.ProbeController;
import com.campus.venue.security.TokenService;
import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** BE-0 裁决 C4：JSON 时间格式严格按 docs/12 第 1 节。 */
@IntegrationTest
@AutoConfigureMockMvc
@Import(ProbeController.class)
class JsonTimeFormatTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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
    void serializesDateTimeAndTimestampInContractFormat() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/time").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        assertThat(result.getResponse().getContentAsString())
                .isEqualTo("{\"date\":\"2026-10-12\",\"time\":\"08:00\",\"instant\":\"2026-10-12T09:00:00\"}");
    }

    @Test
    void dropsFractionalSecondsFromTimestamp() throws Exception {
        // Clock 与 PostgreSQL TIMESTAMP 都带微秒，显式格式保证输出不含小数秒
        LocalDateTime withMicros = LocalDateTime.of(2026, 10, 12, 9, 0, 0, 123456000);

        assertThat(objectMapper.writeValueAsString(withMicros)).isEqualTo("\"2026-10-12T09:00:00\"");
    }

    @Test
    void deserializesContractFormatAndEchoesItBack() throws Exception {
        String json = "{\"date\":\"2026-10-13\",\"time\":\"09:30\",\"instant\":\"2026-10-13T10:15:42\"}";

        MvcResult result = mockMvc.perform(post("/probe/time").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).isEqualTo(json);
    }

    @Test
    void rejectsTimestampWithoutSeconds() throws Exception {
        String json = "{\"date\":\"2026-10-13\",\"time\":\"09:30\",\"instant\":\"2026-10-13T10:15\"}";

        MvcResult result = mockMvc.perform(post("/probe/time").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
    }
}
