package com.campus.venue.support;

import com.campus.venue.security.TokenService;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import org.springframework.jdbc.core.JdbcTemplate;

/** 测试用户与令牌：直接写库造用户（口令与演示口令相同），用应用的 TokenService 签发令牌。 */
public final class TestUsers {

    public static final String PASSWORD = "Demo@1234";
    /** 演示口令的 BCrypt 哈希（docs/13 第 5.3 节）。 */
    public static final String PASSWORD_HASH = "$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m";

    private TestUsers() {
    }

    public static long insert(JdbcTemplate jdbc, String username, Role role, AccountStatus status) {
        String userType = role == Role.USER ? "STUDENT" : "OTHER";
        return jdbc.queryForObject("insert into app_user (username, password_hash, display_name, role, user_type,"
                + " status) values (?, ?, ?, ?, ?, ?) returning id", Long.class,
                username, PASSWORD_HASH, "用户" + username, role.name(), userType, status.name());
    }

    public static long insert(JdbcTemplate jdbc, String username, Role role) {
        return insert(jdbc, username, role, AccountStatus.ACTIVE);
    }

    /** 完整的 Authorization 头值。 */
    public static String bearer(TokenService tokenService, long userId, Role role) {
        return "Bearer " + tokenService.issue(userId, role).token();
    }
}
