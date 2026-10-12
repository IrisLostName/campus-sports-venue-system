package com.campus.venue.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.probe.ProbeController;
import com.campus.venue.security.TokenService;
import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * BE-3 裁决第 12 节：JSON 日期、时间、时间戳严格解析；字段类型/格式错误在 details.fields 中指明字段；
 * 无法定位字段的请求体错误（语法错误、空请求体、裸值请求体）仍为不带 details 的 400。
 */
@IntegrationTest
@AutoConfigureMockMvc
@Import(ProbeController.class)
class JsonBodyStrictnessTest {

    private static final String VALID_DATE = "2026-10-13";
    private static final String VALID_TIME = "09:30";
    private static final String VALID_INSTANT = "2026-10-13T10:15:42";

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

    private String bearer;

    @BeforeEach
    void authenticate() {
        DatabaseCleaner.truncateAll(dataSource);
        bearer = TestUsers.bearer(tokenService, TestUsers.insert(jdbc, "probe_user", Role.USER), Role.USER);
    }

    private MvcResult post(String path, String json) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.post(path)
                .header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();
    }

    private static String timeProbe(String date, String time, String instant) {
        return "{\"date\":\"" + date + "\",\"time\":\"" + time + "\",\"instant\":\"" + instant + "\"}";
    }

    private JsonNode validationError(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("code").asText()).isEqualTo("VALIDATION_ERROR");
        return body;
    }

    private void assertFieldRejected(MvcResult result, String field) throws Exception {
        JsonNode fields = validationError(result).get("details").get("fields");
        assertThat(fields.size()).isEqualTo(1);
        assertThat(fields.get(field).asText()).isEqualTo("类型不符");
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-02-30", "2026-1-5", "2026-13-01", "26-10-13"})
    void rejectsInvalidDatesNamingTheField(String date) throws Exception {
        assertFieldRejected(post("/probe/time", timeProbe(date, VALID_TIME, VALID_INSTANT)), "date");
    }

    @ParameterizedTest
    @ValueSource(strings = {"24:00", "8:00", "09:60", "09:30:00"})
    void rejectsInvalidTimesNamingTheField(String time) throws Exception {
        assertFieldRejected(post("/probe/time", timeProbe(VALID_DATE, time, VALID_INSTANT)), "time");
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-13T10:00", "2026-02-30T10:00:00", "2026-10-13T24:00:00"})
    void rejectsInvalidTimestampsNamingTheField(String instant) throws Exception {
        assertFieldRejected(post("/probe/time", timeProbe(VALID_DATE, VALID_TIME, instant)), "instant");
    }

    @Test
    void acceptsLeapDayInLeapYear() throws Exception {
        MvcResult result = post("/probe/time", timeProbe("2028-02-29", "00:00", "2028-02-29T23:59:59"));

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"abc\"", "1.5", "2.0", "true", "[1]", "{}"})
    void rejectsNonIntegerValuesNamingTheField(String age) throws Exception {
        assertFieldRejected(post("/probe/body", "{\"name\":\"a\",\"age\":" + age + "}"), "age");
    }

    @Test
    void integerValueIsAccepted() throws Exception {
        MvcResult result = post("/probe/body", "{\"name\":\"a\",\"age\":2}");

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{", "", "\"x\"", "5", "{\"name\":}"})
    void bodyErrorsWithoutAFieldCarryNoDetails(String json) throws Exception {
        assertThat(validationError(post("/probe/body", json)).has("details")).isFalse();
    }

    @Test
    void nulCharacterMessageIsUnchanged() throws Exception {
        JsonNode fields = validationError(post("/probe/body", "{\"name\":\"a\\u0000b\"}")).get("details").get("fields");

        assertThat(fields.get("name").asText()).isEqualTo("不能包含 U+0000 字符");
    }
}
