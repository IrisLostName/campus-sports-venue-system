package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.IntegrationTest;
import com.campus.venue.support.TestDatabaseGuard;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * T3、M2：在测试库上追加执行 db/demo，断言种子数据的数量、关键值与 id；
 * 用 BCrypt 校验哈希与演示口令匹配；结束后清库恢复为只有 db/migration 的状态。
 */
@IntegrationTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DemoSeedTest {

    private static final String DEMO_HASH = "$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m";
    private static final String ANNOUNCEMENT_TEXT = "场地保养：每周一 08:00–09:30 视情况关闭 1 片球场";

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    private Flyway flyway(String... locations) {
        return Flyway.configure().dataSource(dataSource).locations(locations).cleanDisabled(false).load();
    }

    @BeforeEach
    void migrateWithSeed() {
        TestDatabaseGuard.require(dataSource);
        Flyway flyway = flyway("classpath:db/migration", "classpath:db/demo");
        flyway.clean();
        flyway.migrate();
    }

    @AfterAll
    void restoreStructureOnly() {
        TestDatabaseGuard.require(dataSource);
        Flyway flyway = flyway("classpath:db/migration");
        flyway.clean();
        flyway.migrate();
        assertThat(jdbc.queryForObject("select count(*) from venue", Integer.class)).isZero();
        assertThat(jdbc.queryForList("select version from flyway_schema_history order by installed_rank",
                String.class)).containsExactly("1");
    }

    private List<String> rows(String sql) {
        return jdbc.queryForList(sql, String.class);
    }

    @Test
    void threeVenuesWithDocumentedIds() {
        assertThat(rows("select id || '|' || name || '|' || venue_type || '|' || user_booking_enabled || '|'"
                + " || operational_status || '|' || coalesce(location, 'NULL') || '|'"
                + " || coalesce(description, 'NULL') from venue order by id"))
                .containsExactly("1|网球馆|TENNIS|true|OPEN|NULL|NULL",
                        "2|羽毛球馆|BADMINTON|false|OPEN|NULL|NULL",
                        "3|游泳馆|SWIMMING|false|OPEN|NULL|NULL");
    }

    @Test
    void sixteenResourcesGetIdsMatchingTheFrontendMock() {
        List<String> expected = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            expected.add(i + "|1|网球场" + i + "|COURT|" + i + "|OPEN");
        }
        for (int i = 1; i <= 6; i++) {
            expected.add((4 + i) + "|2|羽毛球场" + i + "|COURT|" + i + "|OPEN");
        }
        for (int i = 1; i <= 6; i++) {
            expected.add((10 + i) + "|3|泳道" + i + "|LANE|" + i + "|OPEN");
        }

        assertThat(rows("select id || '|' || venue_id || '|' || name || '|' || resource_type || '|' || sort_order"
                + " || '|' || operational_status from resource order by id")).containsExactlyElementsOf(expected);
    }

    @Test
    void weeklyWindowsCoverEveryWeekdayOfEveryVenue() {
        List<String> expected = new ArrayList<>();
        for (int venue = 1; venue <= 3; venue++) {
            String window = venue == 3 ? "09:00:00|21:00:00" : "08:00:00|20:00:00";
            for (int weekday = 1; weekday <= 7; weekday++) {
                expected.add(venue + "|WEEKLY|" + weekday + "|" + window + "|ACTIVE");
            }
        }

        assertThat(rows("select venue_id || '|' || rule_type || '|' || weekday || '|' || open_time::text || '|'"
                + " || close_time::text || '|' || status from availability_rule order by venue_id, weekday"))
                .containsExactlyElementsOf(expected);
        assertThat(jdbc.queryForObject("select count(*) from availability_rule where resource_id is not null"
                + " or created_by is not null or start_date is not null", Integer.class)).isZero();
    }

    @Test
    void sevenAccountsGetIdsInDocumentedOrder() {
        assertThat(rows("select id || '|' || username || '|' || display_name || '|' || role || '|' || user_type"
                + " || '|' || status || '|' || coalesce(phone, 'NULL') from app_user order by id"))
                .containsExactly("1|zhangsan|张三|USER|STUDENT|ACTIVE|NULL",
                        "2|lisi|李四|USER|STUDENT|ACTIVE|NULL",
                        "3|wangwu|王五|USER|TEACHER|ACTIVE|NULL",
                        "4|zhaoliu|赵六|USER|STUDENT|ACTIVE|NULL",
                        "5|admin_tennis|网球馆管理员|VENUE_ADMIN|OTHER|ACTIVE|NULL",
                        "6|admin_pool|游泳羽毛球馆管理员|VENUE_ADMIN|OTHER|ACTIVE|NULL",
                        "7|sysadmin|系统管理员|SYS_ADMIN|OTHER|ACTIVE|NULL");
    }

    @Test
    void everyDemoPasswordHashMatchesTheDemoPassword() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        List<String> hashes = rows("select password_hash from app_user order by id");

        assertThat(hashes).hasSize(7).allMatch(hash -> hash.equals(DEMO_HASH));
        assertThat(hashes).allMatch(hash -> encoder.matches("Demo@1234", hash));
        assertThat(encoder.matches("Demo@12345", hashes.get(0))).isFalse();
    }

    @Test
    void venueAdminsAreScopedAndSysAdminHasNoScopeRows() {
        assertThat(rows("select a.username || '|' || s.venue_id || '|' || s.status || '|' || g.username || '|'"
                + " || coalesce(s.valid_from::text, 'NULL') || '|' || coalesce(s.valid_to::text, 'NULL')"
                + " from admin_venue_scope s join app_user a on a.id = s.admin_id"
                + " join app_user g on g.id = s.granted_by order by s.id"))
                .containsExactly("admin_tennis|1|ACTIVE|sysadmin|NULL|NULL",
                        "admin_pool|2|ACTIVE|sysadmin|NULL|NULL",
                        "admin_pool|3|ACTIVE|sysadmin|NULL|NULL");
    }

    @Test
    void twoAnnouncementsWithContentEqualToTitle() {
        assertThat(rows("select n.scope || '|' || coalesce(n.venue_id::text, 'NULL') || '|' || n.title || '|'"
                + " || (n.title = n.content) || '|' || n.status || '|' || u.username"
                + " from announcement n join app_user u on u.id = n.published_by order by n.id"))
                .containsExactly("SYSTEM|NULL|欢迎使用校园场馆预约系统|true|ACTIVE|sysadmin",
                        "VENUE|1|" + ANNOUNCEMENT_TEXT + "|true|ACTIVE|admin_tennis");
    }

    @Test
    void demoReservationsAreNotSeededBySql() {
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from usage_record", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from repair_report", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from admin_operation_log", Integer.class)).isZero();
    }

    @Test
    void identitySequencesAreAdvancedSoNewRowsNeverCollide() {
        long venueId = insertReturningId("insert into venue (name, venue_type) values ('新场馆', 'OTHER') returning id");
        long userId = insertReturningId("insert into app_user (username, password_hash, display_name, role) "
                + "values ('new_user', 'x', '新用户', 'USER') returning id");
        long resourceId = insertReturningId(
                "insert into resource (venue_id, name) values (1, '网球场5') returning id");
        long ruleId = insertReturningId("insert into availability_rule (venue_id, rule_type, start_date, end_date)"
                + " values (1, 'CLOSURE', '2026-10-20', '2026-10-21') returning id");
        long scopeId = insertReturningId("insert into admin_venue_scope (admin_id, venue_id, granted_by)"
                + " values (5, 2, 7) returning id");
        long announcementId = insertReturningId("insert into announcement (scope, title, content, published_by)"
                + " values ('SYSTEM', 't', 'c', 7) returning id");

        assertThat(venueId).isEqualTo(4);
        assertThat(userId).isEqualTo(8);
        assertThat(resourceId).isEqualTo(17);
        assertThat(ruleId).isEqualTo(22);
        assertThat(scopeId).isEqualTo(4);
        assertThat(announcementId).isEqualTo(3);
    }

    @Test
    void emptyTablesStartTheirIdentityAtOne() {
        long reservationId = insertReturningId("insert into reservation (user_id, resource_id, service_date,"
                + " start_time, end_time) values (1, 1, '2026-10-12', '09:00', '10:30') returning id");
        long usageId = insertReturningId("insert into usage_record (reservation_id, check_in_at)"
                + " values (" + reservationId + ", '2026-10-12 09:00:00') returning id");
        long repairId = insertReturningId("insert into repair_report (venue_id, reporter_id, description)"
                + " values (1, 1, '问题') returning id");
        long logId = insertReturningId("insert into admin_operation_log (admin_id, action, target_type)"
                + " values (7, 'USER_CREATE', 'USER') returning id");

        assertThat(List.of(reservationId, usageId, repairId, logId)).containsOnly(1L);
    }

    private long insertReturningId(String sql) {
        return jdbc.queryForObject(sql, Long.class);
    }
}
