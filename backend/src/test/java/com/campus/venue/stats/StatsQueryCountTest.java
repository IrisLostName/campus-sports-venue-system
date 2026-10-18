package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDate;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-7 T8、D8（裁决 P4、P7）：总览的语句数不随区间天数增加（1 天与 366 天相同），大屏的语句数不随场馆、场地、预约数增加；
 * 且不超过上界（总览 12：令牌认证 1 + 范围与场馆 ≤ 2 + 统计 ≤ 9；大屏 11：场馆 1 + 统计 ≤ 9 + 公告 1）。
 * Hibernate 统计只在本测试类自己的上下文中开启，不改主配置。两种规模的数据都含越过判定点的候选与今天的预约，
 * 使空集合不发查询的分支在两边相同。
 */
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class StatsQueryCountTest extends StatsTestBase {

    private static final long OVERVIEW_BOUND = 12;
    private static final long DISPLAY_BOUND = 11;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private long sysAdmin;
    private long tennisAdmin;
    private long tennis;
    private long owner;

    @FunctionalInterface
    private interface Call {
        MvcResult run() throws Exception;
    }

    /** 一次请求执行的 JDBC 语句数（先预热一次，排除首次调用的一次性开销）。 */
    private long statementsOf(Call call) throws Exception {
        assertThat(call.run().getResponse().getStatus()).isEqualTo(200);
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        MvcResult result = call.run();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return statistics.getPrepareStatementCount();
    }

    /** 1 个场馆、2 片场地；今天一条使用中、一条越过未到场判定点的预约，另有一条关闭规则。 */
    @BeforeEach
    void seedSmall() {
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        tennis = fixtures.bookableVenue("网球馆");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        long court1 = fixtures.resource(tennis, "1号", 1, "OPEN");
        long court2 = fixtures.resource(tennis, "2号", 2, "OPEN");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
        fixtures.closure(tennis, court2, TODAY.plusDays(1), TODAY.plusDays(1));
        owner = user("owner", Role.USER);
        fixtures.usage(reservation(owner, court1, TODAY, "08:00", "CONFIRMED"), TODAY.atTime(7, 55), null);
        reservation(owner, court2, TODAY, "08:00", "CONFIRMED");
    }

    /** 再加 2 个场馆、12 个场地、40 条各种状态与日期的预约（含签到）、关闭规则与 7 条系统公告。 */
    private void seedLarge() {
        String[] statuses = {"CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED", "ADMIN_CANCELLED"};
        for (int v = 0; v < 2; v++) {
            long venue = fixtures.venue("场馆" + v, false, v == 0 ? "OPEN" : "CLOSED");
            fixtures.weeklyEveryDay(venue, "08:00", "11:00");
            fixtures.weekly(venue, 3, "14:00", "17:00");
            fixtures.closure(venue, null, TODAY.minusDays(3), TODAY.minusDays(2));
            for (int r = 0; r < 6; r++) {
                long resource = fixtures.resource(venue, "场地" + r, r, r == 5 ? "MAINTENANCE" : "OPEN");
                for (int k = 0; k < 4; k++) {
                    LocalDate date = TODAY.minusDays(k * 30L);
                    long id = reservation(owner, resource, date, k % 2 == 0 ? "08:00" : "09:30",
                            statuses[(r + k) % statuses.length], date.minusDays(1).atTime(9, 0));
                    if (k == 0 && r < 2) {
                        fixtures.usage(id, date.atTime(7, 58), null);
                    }
                }
            }
            fixtures.closure(venue, null, TODAY, TODAY.plusDays(2));
        }
        for (int i = 0; i < 7; i++) {
            jdbc.update("insert into announcement (scope, title, content, published_by) values ('SYSTEM', ?, ?, ?)",
                    "公告" + i, "公告" + i, sysAdmin);
        }
    }

    @Test
    @DisplayName("总览：1 天与 366 天区间的语句数相同（SA 与 VA，含指定场馆），且不超过 12 条")
    void overviewStatementsDoNotGrowWithTheRange() throws Exception {
        seedLarge();
        String today = TODAY.toString();
        String yearAgo = TODAY.minusDays(365).toString();
        for (long admin : new long[] {sysAdmin, tennisAdmin}) {
            Role role = admin == sysAdmin ? Role.SYS_ADMIN : Role.VENUE_ADMIN;
            long oneDay = statementsOf(() -> overview(admin, role, "dateFrom", today, "dateTo", today));
            long oneYear = statementsOf(() -> overview(admin, role, "dateFrom", yearAgo, "dateTo", today));
            long venueYear = statementsOf(() -> overview(admin, role, "venueId", String.valueOf(tennis),
                    "dateFrom", yearAgo, "dateTo", today));

            assertThat(oneDay).as(role.name()).isPositive().isEqualTo(oneYear).isLessThanOrEqualTo(OVERVIEW_BOUND);
            assertThat(venueYear).as(role.name()).isLessThanOrEqualTo(OVERVIEW_BOUND);
        }
    }

    @Test
    @DisplayName("大屏：1 个场馆 2 片场地与 3 个场馆 14 片场地、40 余条预约时语句数相同，且不超过 11 条")
    void displayStatementsDoNotGrowWithData() throws Exception {
        long small = statementsOf(() -> summary(null));

        seedLarge();
        long large = statementsOf(() -> summary(null));

        assertThat(small).isPositive().isEqualTo(large).isLessThanOrEqualTo(DISPLAY_BOUND);
    }
}
