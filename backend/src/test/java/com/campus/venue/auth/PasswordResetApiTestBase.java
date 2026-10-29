package com.campus.venue.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** SEC-2b 自助找回密码测试的公共工具：造账号（指定姓名与手机号）、发请求、读尝试记录。 */
public abstract class PasswordResetApiTestBase extends AbstractApiTest {

    protected static final String RESET = "/api/v1/auth/password-reset";
    protected static final String NAME = "张三";
    protected static final String PHONE = "13800000001";
    protected static final String NEW_PASSWORD = "NewPassw0rd!";

    /** 直接写库造账号，姓名与手机号可指定（phone 可为 null）；口令为 TestUsers.PASSWORD。 */
    protected long account(String username, Role role, AccountStatus status, String displayName, String phone) {
        long id = TestUsers.insert(jdbc, username, role, status);
        jdbc.update("update app_user set display_name = ?, phone = ? where id = ?", displayName, phone, id);
        return id;
    }

    protected long student(String username) {
        return account(username, Role.USER, AccountStatus.ACTIVE, NAME, PHONE);
    }

    protected static Map<String, Object> request(String username, String displayName, String phone,
            String newPassword) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("username", username);
        body.put("displayName", displayName);
        body.put("phone", phone);
        body.put("newPassword", newPassword);
        return body;
    }

    protected static Map<String, Object> correct(String username) {
        return request(username, NAME, PHONE, NEW_PASSWORD);
    }

    protected static Map<String, Object> wrong(String username) {
        return request(username, NAME, "13900000000", NEW_PASSWORD);
    }

    protected MvcResult reset(Map<String, Object> body) throws Exception {
        return mockMvc.perform(post(RESET).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    protected MvcResult login(String username, String password) throws Exception {
        Map<String, Object> body = Map.of("username", username, "password", password);
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body))).andReturn();
    }

    protected int attempts(String username, boolean succeeded) {
        return jdbc.queryForObject("select count(*) from password_reset_attempt where username = ? and succeeded = ?",
                Integer.class, username, succeeded);
    }

    protected int allAttempts() {
        return jdbc.queryForObject("select count(*) from password_reset_attempt", Integer.class);
    }

    protected String passwordHash(long userId) {
        return jdbc.queryForObject("select password_hash from app_user where id = ?", String.class, userId);
    }
}
