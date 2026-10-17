package com.campus.venue.audit;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import jakarta.persistence.EntityManagerFactory;
import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-6 C2、R5、U1、L2（无 N+1）：BE-6 的各个列表的 SQL 语句数固定，不随返回条数、发布者、报修人、场地、管理员数增加。
 * Hibernate 统计只在本测试类自己的上下文中开启，不改主配置（P8）。
 */
@TestPropertySource(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class AdminListsQueryCountTest extends ImpactApiTestBase {

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private record Listing(long userId, Role role, String url) {
    }

    private Map<String, Listing> listings() {
        Map<String, Listing> map = new LinkedHashMap<>();
        map.put("GET /announcements SYSTEM", new Listing(zhangsan, Role.USER, "/api/v1/announcements?scope=SYSTEM"));
        map.put("GET /announcements VENUE", new Listing(zhangsan, Role.USER,
                "/api/v1/announcements?scope=VENUE&venueId=" + tennis));
        map.put("GET /admin/announcements SA", new Listing(sysAdmin, Role.SYS_ADMIN, "/api/v1/admin/announcements"));
        map.put("GET /admin/announcements VA", new Listing(tennisAdmin, Role.VENUE_ADMIN,
                "/api/v1/admin/announcements"));
        map.put("GET /repairs/me", new Listing(zhangsan, Role.USER, "/api/v1/repairs/me"));
        map.put("GET /admin/repairs SA", new Listing(sysAdmin, Role.SYS_ADMIN, "/api/v1/admin/repairs"));
        map.put("GET /admin/repairs VA", new Listing(tennisAdmin, Role.VENUE_ADMIN, "/api/v1/admin/repairs"));
        map.put("GET /admin/users", new Listing(sysAdmin, Role.SYS_ADMIN, "/api/v1/admin/users?pageSize=100"));
        map.put("GET /admin/logs SA", new Listing(sysAdmin, Role.SYS_ADMIN, "/api/v1/admin/logs?pageSize=100"));
        map.put("GET /admin/logs VA", new Listing(tennisAdmin, Role.VENUE_ADMIN, "/api/v1/admin/logs?pageSize=100"));
        return map;
    }

    private long statements(Listing listing) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        MvcResult result = send(HttpMethod.GET, listing.url(), null, listing.userId(), listing.role());
        assertThat(result.getResponse().getStatus()).as(listing.url()).isEqualTo(200);
        return statistics.getPrepareStatementCount();
    }

    /**
     * 第 from … to−1 组：每组一个发布者（场馆管理员，授权网球馆）、一个报修人，各写系统与网球馆公告、带场地的报修、
     * 网球馆日志各一条。最多 19 组，使每个固定 20 条一页的列表仍在第一页内。
     */
    private void seed(int from, int to) {
        long[] courts = {court1, court2, court3, court4};
        for (int i = from; i < to; i++) {
            long publisher = user("pub" + i, Role.VENUE_ADMIN);
            fixtures.grant(publisher, tennis, sysAdmin);
            long reporter = i == 0 ? zhangsan : user("rep" + i, Role.USER);
            Timestamp at = Timestamp.valueOf(NOW.minusMinutes(i + 1));
            jdbc.update("insert into announcement (scope, title, content, published_by, published_at)"
                    + " values ('SYSTEM', '系统', '内容', ?, ?)", publisher, at);
            jdbc.update("insert into announcement (scope, venue_id, title, content, published_by, published_at)"
                    + " values ('VENUE', ?, '网球馆', '内容', ?, ?)", tennis, publisher, at);
            jdbc.update("insert into repair_report (venue_id, resource_id, reporter_id, description, created_at,"
                    + " updated_at) values (?, ?, ?, '坏了', ?, ?)", tennis, courts[i % 4], reporter, at, at);
            jdbc.update("insert into repair_report (venue_id, reporter_id, description, created_at, updated_at)"
                    + " values (?, ?, '坏了', ?, ?)", tennis, zhangsan, at, at);
            jdbc.update("insert into admin_operation_log (admin_id, venue_id, action, target_type, created_at)"
                    + " values (?, ?, 'VENUE_UPDATE', 'VENUE', ?)", publisher, tennis, at);
        }
    }

    @Test
    @DisplayName("每个列表：1 组与 9 组数据（多个发布者、报修人、场地、管理员）时语句数相同")
    void statementCountsDoNotGrowWithResults() throws Exception {
        seed(0, 1);
        Map<String, Long> one = new LinkedHashMap<>();
        for (Map.Entry<String, Listing> entry : listings().entrySet()) {
            one.put(entry.getKey(), statements(entry.getValue()));
        }

        seed(1, 9);
        for (Map.Entry<String, Listing> entry : listings().entrySet()) {
            assertThat(statements(entry.getValue())).as(entry.getKey()).isEqualTo(one.get(entry.getKey()));
        }
        assertThat(json(send(HttpMethod.GET, "/api/v1/admin/repairs", null, sysAdmin, Role.SYS_ADMIN))
                .get("items")).hasSize(18);
        assertThat(json(send(HttpMethod.GET, "/api/v1/admin/users?pageSize=100", null, sysAdmin, Role.SYS_ADMIN))
                .get("items")).hasSize(21);
    }
}
