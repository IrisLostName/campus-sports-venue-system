package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.support.TestUsers;
import com.campus.venue.user.AdminUserApiTestBase;
import com.campus.venue.user.domain.Role;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * P2-1b：V101__check_in_uuid.sql 为 app_user 增加随机签到标识（docs/13 第 3.1 节）。已有用户由列默认值逐行生成
 * （演示种子先于本迁移执行的情形见 DemoSeedTest），新建用户——直接写库、注册、系统管理员创建——同样自动获得；唯一约束生效。
 */
@DisplayName("P2-1b 签到标识迁移")
class CheckInUuidMigrationTest extends AdminUserApiTestBase {

    private UUID uuidOf(long userId) {
        return jdbc.queryForObject("select check_in_uuid from app_user where id = ?", UUID.class, userId);
    }

    @Test
    @DisplayName("不写该列插入的用户都得到签到标识，且互不相同")
    void everyUserHasADistinctUuid() {
        user("wangwu", Role.USER);
        List<UUID> all = jdbc.queryForList("select check_in_uuid from app_user", UUID.class);

        assertThat(all).hasSize(jdbc.queryForObject("select count(*) from app_user", Integer.class))
                .doesNotContainNull().doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("注册与系统管理员创建的用户自动获得签到标识")
    void registeredAndCreatedUsersGetAUuid() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body("username", "new_user", "password", "Passw0rd!",
                        "displayName", "新用户", "phone", "13800000000")))).andReturn();
        assertThat(registered.getResponse().getStatus()).isEqualTo(201);
        MvcResult created = asSys(HttpMethod.POST, USERS, newAccount("created_user", "USER"));
        assertThat(created.getResponse().getStatus()).isEqualTo(201);

        UUID registeredUuid = uuidOf(json(registered).get("user").get("id").asLong());
        UUID createdUuid = uuidOf(json(created).get("id").asLong());
        assertThat(registeredUuid).isNotNull().isNotEqualTo(createdUuid);
        assertThat(createdUuid).isNotNull();
    }

    @Test
    @DisplayName("唯一约束 uq_app_user_check_in_uuid：写入与他人相同的签到标识被拒绝")
    void duplicateUuidViolatesTheUniqueConstraint() {
        UUID taken = uuidOf(zhangsan);

        assertThatThrownBy(() -> jdbc.update("insert into app_user (username, password_hash, display_name, role,"
                + " user_type, check_in_uuid) values (?, ?, ?, 'USER', 'STUDENT', ?)", "dup_uuid",
                TestUsers.PASSWORD_HASH, "重复", taken))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_app_user_check_in_uuid");
    }
}
