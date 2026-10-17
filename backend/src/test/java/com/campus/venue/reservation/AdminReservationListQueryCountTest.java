package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDate;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * BE-5 A1（无 N+1，裁决第 8 节第 7 条）：列表的 SQL 语句数固定，不随返回条数、预约人、场地数增加。
 * Hibernate 统计只在本测试类自己的上下文中开启，不改主配置。
 */
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class AdminReservationListQueryCountTest extends AdminReservationApiTestBase {

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    /** 一次列表请求执行的 JDBC 语句数（含有效状态候选、计数、本页与映射的批量查询）。 */
    private long statementsOfOneListing(long userId, Role role, String... params) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        ok(list(userId, role, params));
        return statistics.getPrepareStatementCount();
    }

    /** 第 from … to−1 个预约人各一条未来预约与一条已签到、已结束（有效 COMPLETED）的预约，分布在 4 片场地上。 */
    private void seed(int from, int to) {
        long[] courts = {court1, court2, court3, court4};
        for (int i = from; i < to; i++) {
            long owner = user("owner" + i, Role.USER);
            LocalDate date = TOMORROW.plusDays(i / 4);
            reservation(owner, courts[i % 4], date, "08:00");
            fixtures.usage(reservation(owner, courts[i % 4], TODAY.minusDays(i + 1), "08:00"),
                    TODAY.minusDays(i + 1).atTime(7, 50), null);
        }
    }

    @Test
    @DisplayName("1 条与 30 条（30 个预约人、4 片场地、含越过判定点的候选）时语句数相同")
    void statementCountDoesNotGrowWithResults() throws Exception {
        seed(0, 1);
        String[] params = {"status", "CONFIRMED", "keyword", "用户", "pageSize", "100"};
        long sysOne = statementsOfOneListing(sysAdmin, Role.SYS_ADMIN, params);
        long vaOne = statementsOfOneListing(tennisAdmin, Role.VENUE_ADMIN, params);
        long completedOne = statementsOfOneListing(sysAdmin, Role.SYS_ADMIN, "status", "COMPLETED");
        assertThat(sysOne).isPositive();

        seed(1, 30);
        assertThat(itemIds(listAsSys(params))).hasSize(30);
        assertThat(itemIds(listAsSys("status", "COMPLETED", "pageSize", "100"))).hasSize(30);
        assertThat(statementsOfOneListing(sysAdmin, Role.SYS_ADMIN, params)).isEqualTo(sysOne);
        assertThat(statementsOfOneListing(tennisAdmin, Role.VENUE_ADMIN, params)).isEqualTo(vaOne);
        assertThat(statementsOfOneListing(sysAdmin, Role.SYS_ADMIN, "status", "COMPLETED")).isEqualTo(completedOne);
    }
}
