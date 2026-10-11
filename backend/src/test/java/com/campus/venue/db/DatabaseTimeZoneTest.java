package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * C3、C8：Clock 按 APP_TIMEZONE 构造；数据库会话时区与之一致，
 * DEFAULT now() 写入的时间与 Clock 相差不超过 1 分钟。结果不依赖 JVM 默认时区（本机为纽约）。
 */
@IntegrationTest
class DatabaseTimeZoneTest {

    @Value("${app.timezone}")
    private String appTimezone;

    @Autowired
    private Clock clock;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void clockUsesTheConfiguredBusinessTimezone() {
        assertThat(clock.getZone()).isEqualTo(ZoneId.of(appTimezone));
    }

    @Test
    void everyPooledSessionRunsInTheBusinessTimezone() throws SQLException {
        List<Connection> connections = new ArrayList<>();
        try {
            for (int i = 0; i < 3; i++) {
                connections.add(dataSource.getConnection());
            }
            for (Connection connection : connections) {
                assertThat(sessionTimeZone(connection)).isEqualTo(appTimezone);
            }
        } finally {
            for (Connection connection : connections) {
                connection.close();
            }
        }
    }

    @Test
    void defaultNowWritesBusinessLocalTime() {
        DatabaseCleaner.truncateAll(dataSource);
        LocalDateTime before = LocalDateTime.now(clock);

        LocalDateTime stored = jdbc.queryForObject(
                "insert into venue (name, venue_type) values ('时区馆', 'OTHER') returning created_at",
                LocalDateTime.class);

        LocalDateTime after = LocalDateTime.now(clock);
        assertThat(Duration.between(before, stored).abs()).isLessThanOrEqualTo(Duration.ofMinutes(1));
        assertThat(Duration.between(stored, after).abs()).isLessThanOrEqualTo(Duration.ofMinutes(1));
    }

    @Test
    void defaultNowIsNotTheLocalTimeOfAnyOtherZone() {
        DatabaseCleaner.truncateAll(dataSource);

        LocalDateTime stored = jdbc.queryForObject(
                "insert into venue (name, venue_type) values ('时区馆2', 'OTHER') returning created_at",
                LocalDateTime.class);

        int appOffset = clock.getZone().getRules().getOffset(clock.instant()).getTotalSeconds();
        for (String other : List.of("Asia/Shanghai", "America/New_York", "UTC")) {
            ZoneId zone = ZoneId.of(other);
            if (zone.getRules().getOffset(clock.instant()).getTotalSeconds() != appOffset) {
                Duration gap = Duration.between(LocalDateTime.now(Clock.system(zone)), stored).abs();
                assertThat(gap).as(other).isGreaterThan(Duration.ofMinutes(30));
            }
        }
    }

    private static String sessionTimeZone(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("show time zone")) {
            result.next();
            return result.getString(1);
        }
    }
}
