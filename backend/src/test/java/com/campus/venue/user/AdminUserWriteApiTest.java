package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 U2、U3、T5、T7：系统管理员创建与修改账号。 */
class AdminUserWriteApiTest extends AdminUserApiTestBase {

    private MvcResult login(String username, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body("username", username, "password", password))))
                .andReturn();
    }

    @Test
    @DisplayName("08 管理场馆管理员账号与授权范围：SA 创建 VENUE_ADMIN（重复 id 去重）201，授权写入，可登录，USER_CREATE 日志")
    void createsAVenueAdminWithScopes() throws Exception {
        clock.setLocal(LocalDateTime.of(2026, 10, 12, 9, 0, 0));
        MvcResult result = createAsSys(merge(newAccount("va_new", "VENUE_ADMIN"),
                body("venueIds", List.of(badminton, tennis, badminton), "userType", "TEACHER", "phone", " ")));

        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(201);
        JsonNode created = json(result);
        long id = created.get("id").asLong();
        assertThat(created.get("role").asText()).isEqualTo("VENUE_ADMIN");
        assertThat(created.get("userType").asText()).isEqualTo("TEACHER");
        assertThat(created.get("phone").isNull()).isTrue();
        assertThat(created.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(created.get("venueIds").toString()).isEqualTo("[" + tennis + "," + badminton + "]");
        List<Map<String, Object>> scopes = scopeRows(id);
        assertThat(scopes).hasSize(2).allSatisfy(row -> {
            assertThat(row.get("status")).isEqualTo("ACTIVE");
            assertThat(row.get("valid_from")).isNull();
            assertThat(row.get("valid_to")).isNull();
            assertThat(row.get("granted_by")).isEqualTo(sysAdmin);
            assertThat(row.get("granted_at").toString()).isEqualTo("2026-10-12 09:00:00.0");
        });

        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("USER_CREATE");
        assertThat(log.get("target_type")).isEqualTo("USER");
        assertThat(log.get("target_id")).isEqualTo(id);
        assertThat(log.get("venue_id")).isNull();
        assertThat(log.get("reason")).isNull();
        assertThat(snapshot(log, "before_snapshot").get("object").isNull()).isTrue();
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(created);

        MvcResult loggedIn = login("va_new", "Passw0rd!");
        assertThat(loggedIn.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(loggedIn).get("user").get("venueIds").toString())
                .isEqualTo("[" + tennis + "," + badminton + "]");
    }

    @Test
    @DisplayName("08 创建/停用用户账号：其他角色忽略 venueIds（不写授权，但仍检查存在性）；userType 缺省 STUDENT")
    void otherRolesIgnoreVenueIds() throws Exception {
        MvcResult result = createAsSys(merge(newAccount("plain", "USER"), body("venueIds", List.of(tennis))));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode created = json(result);
        assertThat(created.get("venueIds").isNull()).isTrue();
        assertThat(created.get("userType").asText()).isEqualTo("STUDENT");
        assertThat(scopeRows(created.get("id").asLong())).isEmpty();

        JsonNode error = assertError(createAsSys(merge(newAccount("sys2", "SYS_ADMIN"),
                body("venueIds", List.of(999999)))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(error).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        assertThat(createAsSys(newAccount("sys2", "SYS_ADMIN")).getResponse().getStatus()).isEqualTo(201);
        assertThat(createAsSys(merge(newAccount("va_empty", "VENUE_ADMIN"), body("venueIds", List.of())))
                .getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("U2 四种失败：格式、USERNAME_TAKEN、不存在场馆、角色（VA、USER）；均不写入、不写日志")
    void createFailures() throws Exception {
        JsonNode format = assertError(createAsSys(body("username", "ab", "password", "short", "displayName", " ",
                "role", "ADMIN", "userType", "student", "phone", "1".repeat(21), "venueIds", Arrays.asList(1, null))),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(format).get("username").asText()).isEqualTo("须为 3–32 位字母、数字或下划线");
        assertThat(fields(format).get("password").asText()).isEqualTo("长度须为 8–64 位");
        assertThat(fields(format).get("displayName").asText()).isEqualTo("必填");
        assertThat(fields(format).get("role").asText()).isEqualTo("应为 USER/VENUE_ADMIN/SYS_ADMIN 之一");
        assertThat(fields(format).get("userType").asText()).isEqualTo("须为 STUDENT、TEACHER 或 OTHER");
        assertThat(fields(format).get("phone").asText()).isEqualTo("不能超过 20 个字符");
        assertThat(fields(format).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        JsonNode missingRole = assertError(createAsSys(body("username", "x_y_z", "password", "Passw0rd!",
                "displayName", "名")), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missingRole).get("role").asText()).isEqualTo("必填");
        JsonNode zero = assertError(createAsSys(merge(newAccount("zero", "VENUE_ADMIN"),
                body("venueIds", List.of(0)))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(zero).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");
        JsonNode typed = assertError(createAsSys(merge(newAccount("typed", "VENUE_ADMIN"),
                body("venueIds", List.of("abc")))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(typed).get("venueIds[0]").asText()).isEqualTo("类型不符");

        assertError(createAsSys(newAccount("zhangsan", "USER")), ErrorCode.USERNAME_TAKEN);
        // 用户名冲突先于场馆存在性
        assertError(createAsSys(merge(newAccount("zhangsan", "VENUE_ADMIN"), body("venueIds", List.of(999999)))),
                ErrorCode.USERNAME_TAKEN);
        JsonNode missingVenue = assertError(createAsSys(merge(newAccount("va_x", "VENUE_ADMIN"),
                body("venueIds", List.of(tennis, 999999)))), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(missingVenue).get("venueIds").asText()).isEqualTo("应为已存在场馆 id 组成的数组");

        assertError(asTennisAdmin(HttpMethod.POST, USERS, newAccount("by_va", "USER")), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.POST, USERS, newAccount("by_user", "USER"), zhangsan, Role.USER),
                ErrorCode.FORBIDDEN);
        // 格式先于角色
        assertError(send(HttpMethod.POST, USERS, body("username", "ab"), zhangsan, Role.USER),
                ErrorCode.VALIDATION_ERROR);

        assertThat(jdbc.queryForObject("select count(*) from app_user", Integer.class)).isEqualTo(4);
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("U2 并发创建同名账号：恰好一个 201，其余 USERNAME_TAKEN，库中恰一行、一条日志")
    void concurrentCreatesOfOneUsername() throws Exception {
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tasks.add(() -> createAsSys(newAccount("racer", "USER")));
        }

        List<MvcResult> results = ConcurrentRequests.runTogether(tasks);

        assertThat(results).filteredOn(result -> result.getResponse().getStatus() == 201).hasSize(1);
        for (MvcResult result : results) {
            if (result.getResponse().getStatus() != 201) {
                assertError(result, ErrorCode.USERNAME_TAKEN);
            }
        }
        assertThat(jdbc.queryForObject("select count(*) from app_user where username = 'racer'", Integer.class))
                .isEqualTo(1);
        assertThat(logCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-02 08 创建/停用用户账号：SA 停用他人 → 其令牌下一次请求即 ACCOUNT_DISABLED；日志；重新启用后恢复")
    void disablingTakesEffectOnTheNextRequest() throws Exception {
        String token = bearer(zhangsan, Role.USER);
        assertThat(mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, token)).andReturn()
                .getResponse().getStatus()).isEqualTo(200);
        clock.setLocal(LocalDateTime.of(2026, 10, 12, 9, 0, 0));

        MvcResult result = asSys(HttpMethod.PATCH, USER, body("status", "DISABLED"), zhangsan);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(result).get("status").asText()).isEqualTo("DISABLED");
        assertThat(userRow(zhangsan).get("updated_at").toString()).isEqualTo("2026-10-12 09:00:00.0");
        assertError(mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, token)).andReturn(),
                ErrorCode.ACCOUNT_DISABLED);
        assertError(login("zhangsan", "Demo@1234"), ErrorCode.ACCOUNT_DISABLED);
        Map<String, Object> log = onlyLog();
        assertThat(log.get("action")).isEqualTo("USER_STATUS_CHANGE");
        assertThat(log.get("target_type")).isEqualTo("USER");
        assertThat(log.get("target_id")).isEqualTo(zhangsan);
        assertThat(log.get("venue_id")).isNull();
        assertThat(snapshot(log, "before_snapshot").get("object").get("status").asText()).isEqualTo("ACTIVE");
        assertThat(snapshot(log, "after_snapshot").get("object").get("status").asText()).isEqualTo("DISABLED");

        assertThat(json(asSys(HttpMethod.PATCH, USER, body("status", "ACTIVE"), zhangsan)).get("status").asText())
                .isEqualTo("ACTIVE");
        assertThat(mockMvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, token)).andReturn()
                .getResponse().getStatus()).isEqualTo(200);
        assertThat(logCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("U3 停用自己 → INVALID_STATE {status: ACTIVE}；不存在 NOT_FOUND；VA、USER FORBIDDEN；格式先于角色")
    void updateFailures() throws Exception {
        JsonNode self = assertError(asSys(HttpMethod.PATCH, USER, body("status", "DISABLED"), sysAdmin),
                ErrorCode.INVALID_STATE);
        assertThat(self.get("details").get("status").asText()).isEqualTo("ACTIVE");
        assertError(asSys(HttpMethod.PATCH, USER, body("status", "DISABLED"), 999999), ErrorCode.NOT_FOUND);
        assertError(asTennisAdmin(HttpMethod.PATCH, USER, body("status", "DISABLED"), zhangsan), ErrorCode.FORBIDDEN);
        assertError(send(HttpMethod.PATCH, USER, body("displayName", "改"), lisi, Role.USER, zhangsan),
                ErrorCode.FORBIDDEN);
        JsonNode format = assertError(send(HttpMethod.PATCH, USER, body("displayName", " ", "status", "LOCKED"),
                lisi, Role.USER, zhangsan), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(format).get("displayName").asText()).isEqualTo("不能为空");
        assertThat(fields(format).get("status").asText()).isEqualTo("应为 ACTIVE/DISABLED 之一");
        JsonNode tooLong = assertError(asSys(HttpMethod.PATCH, USER, body("displayName", "名".repeat(51)), zhangsan),
                ErrorCode.VALIDATION_ERROR);
        assertThat(fields(tooLong).get("displayName").asText()).isEqualTo("不能超过 50 个字符");

        assertThat(userRow(sysAdmin).get("status")).isEqualTo("ACTIVE");
        assertThat(userRow(zhangsan).get("display_name")).isEqualTo("用户zhangsan");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("U3 只改姓名：200、updated_at 取 Clock、不写日志；{} 与 null 字段原样返回、不改 updated_at；不能改角色")
    void renameDoesNotLogAndEmptyPatchIsANoOp() throws Exception {
        Object updatedBefore = userRow(zhangsan).get("updated_at");

        JsonNode same = json(asSys(HttpMethod.PATCH, USER, body(), zhangsan));
        assertThat(same.get("displayName").asText()).isEqualTo("用户zhangsan");
        assertThat(json(asSys(HttpMethod.PATCH, USER, body("displayName", null, "status", null, "role", "SYS_ADMIN"),
                zhangsan)).get("role").asText()).isEqualTo("USER");
        assertThat(json(asSys(HttpMethod.PATCH, USER, body("status", "ACTIVE"), zhangsan)).get("status").asText())
                .isEqualTo("ACTIVE");
        assertThat(userRow(zhangsan).get("updated_at")).isEqualTo(updatedBefore);

        clock.setLocal(LocalDateTime.of(2026, 10, 12, 10, 0, 0));
        JsonNode renamed = json(asSys(HttpMethod.PATCH, USER, body("displayName", " 张三 "), zhangsan));
        assertThat(renamed.get("displayName").asText()).isEqualTo(" 张三 ");
        assertThat(userRow(zhangsan).get("display_name")).isEqualTo(" 张三 ");
        assertThat(userRow(zhangsan).get("updated_at").toString()).isEqualTo("2026-10-12 10:00:00.0");
        assertThat(userRow(zhangsan).get("role")).isEqualTo("USER");
        assertThat(logCount()).isZero();
    }

    @Test
    @DisplayName("08 管理场馆管理员账号与授权范围：未登录 401")
    void needsLogin() throws Exception {
        assertError(mockMvc.perform(get(USERS)).andReturn(), ErrorCode.AUTH_REQUIRED);
        assertError(mockMvc.perform(post(USERS).contentType(MediaType.APPLICATION_JSON).content("{}")).andReturn(),
                ErrorCode.AUTH_REQUIRED);
    }
}
