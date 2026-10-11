package com.campus.venue.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.probe.ProbeController;
import com.campus.probe.ValidatedProbeController;
import com.campus.venue.security.TokenService;
import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** BE-0 裁决 R2、R3、R4：异常到 ErrorBody 的映射、响应体形状、500 不泄露异常原文。 */
@IntegrationTest
@AutoConfigureMockMvc
@Import({ProbeController.class, ValidatedProbeController.class})
class ErrorHandlingTest {

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

    private JsonNode errorOf(MvcResult result, int status, ErrorCode code) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(status);
        assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("code").asText()).isEqualTo(code.name());
        assertThat(body.get("message").asText()).isEqualTo(code.getDefaultMessage());
        return body;
    }

    private List<String> keysOf(JsonNode body) {
        List<String> keys = new ArrayList<>();
        body.fieldNames().forEachRemaining(keys::add);
        return keys;
    }

    @ParameterizedTest
    @EnumSource(ErrorCode.class)
    void everyBusinessExceptionMapsToItsCodeStatusAndDefaultMessage(ErrorCode code) throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/business").header(HttpHeaders.AUTHORIZATION, bearer).param("code", code.name())).andReturn();

        JsonNode body = errorOf(result, code.getStatus().value(), code);
        assertThat(keysOf(body)).containsExactly("code", "message");
    }

    @Test
    void businessExceptionDetailsAreReturnedWhenPresent() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/business").header(HttpHeaders.AUTHORIZATION, bearer)
                .param("code", "DATE_OUT_OF_RANGE").param("detail", "7")).andReturn();

        JsonNode body = errorOf(result, 400, ErrorCode.DATE_OUT_OF_RANGE);
        assertThat(keysOf(body)).containsExactly("code", "message", "details");
        assertThat(body.get("details").get("reason").asText()).isEqualTo("7");
    }

    @Test
    void invalidRequestBodyReturnsFieldReasons() throws Exception {
        MvcResult result = mockMvc.perform(post("/probe/body").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\",\"age\":0}")).andReturn();

        JsonNode fields = errorOf(result, 400, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("name").asText()).isNotBlank();
        assertThat(fields.get("age").asText()).isNotBlank();
        assertThat(fields.size()).isEqualTo(2);
    }

    @Test
    void unparseableBodyReturnsValidationErrorWithoutDetails() throws Exception {
        MvcResult result = mockMvc.perform(post("/probe/body").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{")).andReturn();

        assertThat(keysOf(errorOf(result, 400, ErrorCode.VALIDATION_ERROR))).containsExactly("code", "message");
    }

    @Test
    void parameterTypeMismatchNamesTheParameter() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/count").header(HttpHeaders.AUTHORIZATION, bearer).param("count", "abc")).andReturn();

        JsonNode fields = errorOf(result, 400, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("count").asText()).isEqualTo("类型不符");
    }

    @Test
    void missingRequiredParameterNamesTheParameter() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/count").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        JsonNode fields = errorOf(result, 400, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("count").asText()).isEqualTo("缺少必填参数");
    }

    @Test
    void builtInMethodParameterValidationReturnsFieldReasons() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/min").header(HttpHeaders.AUTHORIZATION, bearer).param("size", "0")).andReturn();

        JsonNode fields = errorOf(result, 400, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("size").asText()).isNotBlank();
    }

    @Test
    void validatedControllerConstraintViolationReturnsFieldReasons() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/validated").header(HttpHeaders.AUTHORIZATION, bearer).param("page", "0")).andReturn();

        JsonNode fields = errorOf(result, 400, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
        assertThat(fields.get("page").asText()).isNotBlank();
    }

    @Test
    void unknownPathReturnsNotFoundErrorBody() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/does-not-exist").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        assertThat(keysOf(errorOf(result, 404, ErrorCode.NOT_FOUND))).containsExactly("code", "message");
    }

    @Test
    void unsupportedMethodMapsToNotFound() throws Exception {
        MvcResult result = mockMvc.perform(post("/probe/get-only").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        assertThat(keysOf(errorOf(result, 404, ErrorCode.NOT_FOUND))).containsExactly("code", "message");
    }

    @Test
    void unsupportedMediaTypeMapsToValidationError() throws Exception {
        MvcResult result = mockMvc.perform(post("/probe/json-only").header(HttpHeaders.AUTHORIZATION, bearer)
                .contentType(MediaType.TEXT_PLAIN).content("x")).andReturn();

        assertThat(keysOf(errorOf(result, 400, ErrorCode.VALIDATION_ERROR))).containsExactly("code", "message");
    }

    @Test
    void notAcceptableMapsToValidationError() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/xml-only").header(HttpHeaders.AUTHORIZATION, bearer).accept(MediaType.APPLICATION_JSON)).andReturn();

        assertThat(keysOf(errorOf(result, 400, ErrorCode.VALIDATION_ERROR))).containsExactly("code", "message");
    }

    @Test
    void unexpectedExceptionReturnsInternalErrorWithoutLeakingDetails() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/boom").header(HttpHeaders.AUTHORIZATION, bearer)).andReturn();

        JsonNode body = errorOf(result, 500, ErrorCode.INTERNAL_ERROR);
        assertThat(keysOf(body)).containsExactly("code", "message");
        String raw = result.getResponse().getContentAsString();
        assertThat(raw).doesNotContain("secret-internal-detail")
                .doesNotContain("IllegalStateException")
                .doesNotContain("stackTrace")
                .doesNotContain("at com.campus");
    }

    /** BE-1 起探针路径不是公开接口：不带令牌得到 AUTH_REQUIRED，而不是执行探针。 */
    @Test
    void probeWithoutTokenRequiresAuthentication() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/boom")).andReturn();

        JsonNode body = errorOf(result, 401, ErrorCode.AUTH_REQUIRED);
        assertThat(keysOf(body)).containsExactly("code", "message");
    }
}
