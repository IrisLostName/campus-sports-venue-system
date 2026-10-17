package com.campus.venue.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.auth.service.AccountCreator.NewAccount;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-6 P1、P3：注册与创建账号共用的落库与唯一冲突翻译。绕过用户名预检查直接插入同名账号时，
 * 唯一约束冲突必须翻译为 USERNAME_TAKEN（不依赖并发时序，确定性地覆盖翻译分支）。
 */
class AccountCreatorTest extends AbstractApiTest {

    @Autowired
    private AccountCreator accountCreator;

    @Test
    void insertWithoutThePreCheckTranslatesTheUniqueViolationToUsernameTaken() {
        TestUsers.insert(jdbc, "taken", Role.USER);

        assertThatThrownBy(() -> accountCreator.insert(
                new NewAccount("taken", "Passw0rd!", "同名", Role.VENUE_ADMIN, null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.USERNAME_TAKEN));
        assertThat(jdbc.queryForObject("select count(*) from app_user where username = 'taken'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void createRejectsAnExistingUsernameBeforeInserting() {
        TestUsers.insert(jdbc, "taken", Role.USER);

        assertThatThrownBy(() -> accountCreator.create(
                new NewAccount("taken", "Passw0rd!", "同名", Role.USER, null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.USERNAME_TAKEN));
    }

    /** 落库字段与注册原有做法一致：时间戳取 Clock 截断到微秒、空白电话存 NULL、userType 缺省 STUDENT、状态 ACTIVE。 */
    @Test
    void storesTheSameFieldsAsRegistration() {
        clock.setLocal(LocalDateTime.of(2026, 10, 13, 21, 5, 7, 123_456_789));

        accountCreator.create(new NewAccount("va_new", "Passw0rd!", "  场馆 管理员 ", Role.VENUE_ADMIN, null, "   "));

        Map<String, Object> row = jdbc.queryForMap("select * from app_user where username = 'va_new'");
        assertThat(row.get("role")).isEqualTo("VENUE_ADMIN");
        assertThat(row.get("user_type")).isEqualTo("STUDENT");
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        assertThat(row.get("phone")).isNull();
        assertThat(row.get("display_name")).isEqualTo("  场馆 管理员 ");
        assertThat(row.get("created_at").toString()).isEqualTo("2026-10-13 21:05:07.123456");
        assertThat(row.get("updated_at").toString()).isEqualTo("2026-10-13 21:05:07.123456");
    }
}
