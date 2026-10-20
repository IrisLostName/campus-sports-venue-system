package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.LockHolder;
import com.campus.venue.support.RecordingStatementInspector;
import com.campus.venue.user.domain.Role;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 K3（BE-6 第 13 节注意 2、台账 S-032）：两个 SYS_ADMIN 同时互相停用。
 * 确定性做法：持锁方以 LOCK TABLE admin_operation_log IN SHARE MODE 挡住写日志，两个 PATCH 各自锁定并更新了目标用户行后
 * 都停在插入日志之前（经 pg_stat_activity 确认）；放行后两次插入的外键检查各对“被对方锁住的操作者行”取 FOR KEY SHARE。
 * 用户行锁若是 FOR UPDATE，此处成环、PostgreSQL 中止其一（500）；Hibernate 对 PESSIMISTIC_WRITE 实际发出
 * FOR NO KEY UPDATE（由本类上下文中的 RecordingStatementInspector 记录并断言，P1），与 FOR KEY SHARE 兼容，两次都成功。
 * 已知限制（P2）：两次都成功后系统中不再有任何有效的 SYS_ADMIN，恢复需要直接操作数据库；契约已定稿，不新增规则或错误码。
 */
@TestPropertySource(properties = "spring.jpa.properties.hibernate.session_factory.statement_inspector="
        + "com.campus.venue.support.RecordingStatementInspector")
class MutualDisableTest extends AdminUserApiTestBase {

    @Autowired
    private DataSource dataSource;

    private LockHolder holder;
    private ExecutorService pool;
    private long otherSysAdmin;

    @BeforeEach
    void openHolder() throws Exception {
        otherSysAdmin = user("sysadmin2", Role.SYS_ADMIN);
        holder = LockHolder.open(dataSource, jdbc);
        pool = Executors.newFixedThreadPool(2);
        RecordingStatementInspector.clear();
    }

    @AfterEach
    void closeHolder() throws Exception {
        try {
            holder.close();
        } finally {
            pool.shutdownNow();
        }
    }

    private Future<MvcResult> disable(long actor, long target) {
        return pool.submit(() -> send(HttpMethod.PATCH, USER, body("status", "DISABLED"), actor, Role.SYS_ADMIN,
                target));
    }

    @Test
    @DisplayName("TEST-1 K3 已知限制：两个 SYS_ADMIN 同时互相停用，用户行锁为 FOR NO KEY UPDATE，无死锁、均 200；"
            + "结果系统中没有有效的 SYS_ADMIN（恢复需直接操作数据库）")
    void twoSysAdminsDisablingEachOtherBothSucceedLeavingNoActiveSysAdmin() throws Exception {
        holder.execute("lock table admin_operation_log in share mode");

        Future<MvcResult> first = disable(sysAdmin, otherSysAdmin);
        Future<MvcResult> second = disable(otherSysAdmin, sysAdmin);
        holder.awaitBlocked(2, List.of(first, second));
        assertThat(holder.blockedQueries()).hasSize(2)
                .allSatisfy(sql -> assertThat(sql.toLowerCase()).startsWith("insert into admin_operation_log"));
        assertThat(RecordingStatementInspector.containing("from app_user").stream()
                .filter(sql -> sql.toLowerCase().contains(" for ")).toList())
                .as("两个停用请求锁定目标用户行的语句").hasSize(2)
                .allSatisfy(sql -> assertThat(sql.toLowerCase()).endsWith(" for no key update"));
        holder.commit();

        assertThat(first.get(60, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
        assertThat(second.get(60, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
        assertThat(userRow(sysAdmin)).containsEntry("status", "DISABLED");
        assertThat(userRow(otherSysAdmin)).containsEntry("status", "DISABLED");
        assertThat(jdbc.queryForList("select admin_id from admin_operation_log where action = 'USER_STATUS_CHANGE'"
                + " order by admin_id", Long.class)).containsExactly(sysAdmin, otherSysAdmin);
        assertThat(jdbc.queryForObject("select count(*) from app_user where role = 'SYS_ADMIN' and status = 'ACTIVE'",
                Integer.class)).isZero();
    }
}
