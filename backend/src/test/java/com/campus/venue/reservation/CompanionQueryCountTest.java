package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.support.RecordingStatementInspector;
import com.campus.venue.user.domain.Role;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDate;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * P2-2b 裁决第 1 节第 4 条（无 N+1）：同行人名单一次批量读取，同行人与预约人合并为一次用户批量查询。
 * 每个预约 6 位各不相同的同行人时，“我的预约”与管理端列表的语句数不随预约条数增加，且每次列表只有一条读取名单的语句。
 * Hibernate 统计与语句记录只在本测试类自己的上下文中开启，不改主配置。
 */
@DisplayName("P2-2b 同行人名单的查询次数")
@TestPropertySource(properties = {"spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.session_factory.statement_inspector="
                + "com.campus.venue.support.RecordingStatementInspector"})
class CompanionQueryCountTest extends AdminReservationApiTestBase {

    private static final String COMPANION_SELECT = "from reservation_companion";

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    /** zhangsan 第 from … to−1 条未来预约，各带 6 位新建的同行人，分布在 4 片场地上。 */
    private void seed(int from, int to) {
        long[] courts = {court1, court2, court3, court4};
        for (int i = from; i < to; i++) {
            LocalDate date = TOMORROW.plusDays(i / 4);
            long id = reservation(zhangsan, courts[i % 4], date, "08:00");
            for (int position = 1; position <= 6; position++) {
                fixtures.companion(id, user("c" + i + "_" + position, Role.USER), position);
            }
        }
    }

    private MvcResult mine() throws Exception {
        return mockMvc.perform(get("/api/v1/reservations/me").param("pageSize", "100")
                .header(HttpHeaders.AUTHORIZATION, bearer(zhangsan, Role.USER))).andReturn();
    }

    /** 一次请求的 JDBC 语句数；同时断言其中读取名单的语句恰好一条。 */
    private long statementsOf(Request request) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        RecordingStatementInspector.clear();
        ok(request.send());
        assertThat(RecordingStatementInspector.containing(COMPANION_SELECT)).hasSize(1);
        return statistics.getPrepareStatementCount();
    }

    private interface Request {
        MvcResult send() throws Exception;
    }

    @Test
    @DisplayName("1 条与 30 条预约（每条 6 位同行人）时，我的预约与管理端列表的语句数相同")
    void statementCountDoesNotGrowWithReservationsOrCompanions() throws Exception {
        Request adminList = () -> listAsSys("pageSize", "100");
        seed(0, 1);
        long mineOne = statementsOf(this::mine);
        long adminOne = statementsOf(adminList);
        assertThat(mineOne).isPositive();

        seed(1, 30);
        assertThat(ok(mine()).get("items")).hasSize(30);
        assertThat(ok(listAsSys("pageSize", "100")).get("items").get(0).get("companions")).hasSize(6);
        assertThat(statementsOf(this::mine)).isEqualTo(mineOne);
        assertThat(statementsOf(adminList)).isEqualTo(adminOne);
    }
}
