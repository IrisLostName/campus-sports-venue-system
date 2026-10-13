package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.reservation.service.DemoReservationSeeder;
import com.campus.venue.support.GuardedFlywayConfig;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.MutableClockConfig;
import com.campus.venue.support.TestDatabaseGuard;
import java.time.LocalDateTime;
import java.util.List;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * R2：demo profile 下（在测试库上追加执行 db/demo），启动时 DemoReservationSeeder 在空表中插入两条演示预约且字段正确；
 * 表非空时不再插入；“明天”与时间戳取 Clock。结束后清库恢复为只有 db/migration 的状态（同 DemoSeedTest）。
 */
@SpringBootTest
@ActiveProfiles({"test", "demo"})
@Import({GuardedFlywayConfig.class, MutableClockConfig.class})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DemoReservationSeederTest {

    private static final String ROWS = "select u.username || '|' || s.name || '|' || r.service_date || '|'"
            + " || to_char(r.start_time, 'HH24:MI') || '|' || to_char(r.end_time, 'HH24:MI') || '|' || r.status"
            + " || '|' || coalesce(r.purpose, 'NULL') || '|' || r.created_at || '|' || r.updated_at"
            + " from reservation r join app_user u on u.id = r.user_id join resource s on s.id = r.resource_id"
            + " order by r.id";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private MutableClock clock;

    @Autowired
    private DemoReservationSeeder seeder;

    private List<String> insertedAtStartup;

    @BeforeAll
    void captureStartupRows() {
        insertedAtStartup = jdbc.queryForList(ROWS, String.class);
    }

    @AfterAll
    void restoreStructureOnly() {
        TestDatabaseGuard.require(dataSource);
        Flyway flyway = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration")
                .cleanDisabled(false).load();
        flyway.clean();
        flyway.migrate();
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isZero();
    }

    @Test
    void startupSeedsTwoReservationsForTomorrow() {
        assertThat(insertedAtStartup).containsExactly(
                "zhangsan|网球场1|2026-10-13|08:00|09:30|CONFIRMED|NULL|2026-10-12 08:30:15|2026-10-12 08:30:15",
                "lisi|网球场2|2026-10-13|09:30|11:00|CONFIRMED|NULL|2026-10-12 08:30:15|2026-10-12 08:30:15");
        assertThat(jdbc.queryForObject("select count(*) from reservation r join app_user u on u.id = r.user_id"
                + " where u.username = 'wangwu'", Integer.class)).isZero();
    }

    @Test
    void nonEmptyTableIsLeftAlone() throws Exception {
        jdbc.update("delete from reservation where id <> (select min(id) from reservation)");
        int before = jdbc.queryForObject("select count(*) from reservation", Integer.class);

        seeder.run(null);
        seeder.run(null);

        assertThat(before).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isEqualTo(1);
    }

    @Test
    void emptyTableIsSeededRelativeToTheClock() throws Exception {
        jdbc.update("delete from reservation");
        clock.setLocal(LocalDateTime.of(2026, 11, 1, 22, 5, 7));
        try {
            seeder.run(null);
        } finally {
            clock.reset();
        }

        assertThat(jdbc.queryForList(ROWS, String.class)).containsExactly(
                "zhangsan|网球场1|2026-11-02|08:00|09:30|CONFIRMED|NULL|2026-11-01 22:05:07|2026-11-01 22:05:07",
                "lisi|网球场2|2026-11-02|09:30|11:00|CONFIRMED|NULL|2026-11-01 22:05:07|2026-11-01 22:05:07");
    }
}
