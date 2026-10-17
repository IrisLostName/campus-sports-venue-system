package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-6 用户与授权接口测试的公共工具。数据沿用 ImpactApiTestBase：sysadmin、admin_tennis（网球馆）、zhangsan、lisi。 */
public abstract class AdminUserApiTestBase extends ImpactApiTestBase {

    protected static final String USERS = "/api/v1/admin/users";
    protected static final String USER = "/api/v1/admin/users/{id}";
    protected static final String SCOPE = "/api/v1/admin/users/{id}/venue-scope";

    protected static Map<String, Object> newAccount(String username, String role) {
        return body("username", username, "password", "Passw0rd!", "displayName", "新" + username, "role", role);
    }

    protected MvcResult createAsSys(Map<String, Object> request) throws Exception {
        return asSys(HttpMethod.POST, USERS, request);
    }

    protected Map<String, Object> userRow(long id) {
        return jdbc.queryForMap("select * from app_user where id = ?", id);
    }

    protected List<Map<String, Object>> scopeRows(long adminId) {
        return jdbc.queryForList("select * from admin_venue_scope where admin_id = ? order by venue_id", adminId);
    }

    protected List<Long> pageIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).get("items").forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    protected JsonNode fields(JsonNode error) {
        return error.get("details").get("fields");
    }
}
