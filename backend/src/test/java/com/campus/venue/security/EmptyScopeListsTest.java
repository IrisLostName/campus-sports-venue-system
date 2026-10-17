package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * BE-6 P4：场馆管理员的有效授权为空时，各列表不生成 IN ()：公告只见系统公告，报修与日志得空页。
 * 授权经真实接口撤销（PUT venue-scope 空数组），同一令牌立即生效。
 */
class EmptyScopeListsTest extends ImpactApiTestBase {

    @Test
    @DisplayName("ACC-M3-07 撤销全部授权后：管理端公告只见系统公告；报修与日志为空页（无 500）")
    void listsAfterAllScopesAreRevoked() throws Exception {
        long system = jdbc.queryForObject("insert into announcement (scope, title, content, published_by,"
                + " published_at) values ('SYSTEM', '系统', '内容', ?, ?) returning id", Long.class, sysAdmin,
                Timestamp.valueOf(NOW.minusHours(1)));
        jdbc.update("insert into announcement (scope, venue_id, title, content, published_by, published_at)"
                + " values ('VENUE', ?, '网球馆', '内容', ?, ?)", tennis, sysAdmin, Timestamp.valueOf(NOW));
        jdbc.update("insert into repair_report (venue_id, reporter_id, description, created_at, updated_at)"
                + " values (?, ?, '坏了', ?, ?)", tennis, zhangsan, Timestamp.valueOf(NOW), Timestamp.valueOf(NOW));
        jdbc.update("insert into admin_operation_log (admin_id, venue_id, action, target_type, created_at)"
                + " values (?, ?, 'VENUE_UPDATE', 'VENUE', ?)", tennisAdmin, tennis, Timestamp.valueOf(NOW));
        assertThat(items("/api/v1/admin/repairs")).hasSize(1);

        assertThat(asSys(HttpMethod.PUT, "/api/v1/admin/users/{id}/venue-scope", body("venueIds", List.of()),
                tennisAdmin).getResponse().getStatus()).isEqualTo(200);

        JsonNode notices = items("/api/v1/admin/announcements");
        assertThat(notices).hasSize(1);
        assertThat(notices.get(0).get("id").asLong()).isEqualTo(system);
        assertThat(items("/api/v1/admin/repairs")).isEmpty();
        JsonNode logs = json(send(HttpMethod.GET, "/api/v1/admin/logs", null, tennisAdmin, Role.VENUE_ADMIN));
        assertThat(logs.get("items")).isEmpty();
        assertThat(logs.get("total").asLong()).isZero();
    }

    private JsonNode items(String url) throws Exception {
        var result = send(HttpMethod.GET, url, null, tennisAdmin, Role.VENUE_ADMIN);
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result).get("items");
    }
}
