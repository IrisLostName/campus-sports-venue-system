package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.support.ImpactApiTestBase;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * BE-5 管理端预约接口测试的公共工具（docs/12 第 5.7 节）。数据沿用 ImpactApiTestBase：时钟 2026-10-12（周一）08:30:15，
 * 网球馆（admin_tennis 授权）网球场1…4、每天 08:00–20:00；羽毛球馆（admin_tennis 无授权）羽毛球场1。
 */
public abstract class AdminReservationApiTestBase extends ImpactApiTestBase {

    protected static final String LIST = "/api/v1/admin/reservations";
    protected static final String CANCEL = "/api/v1/admin/reservations/{id}/cancel";
    protected static final String REASSIGN_RESOURCE = "/api/v1/admin/reservations/{id}/reassign-resource";
    protected static final String REASSIGN_USER = "/api/v1/admin/reservations/{id}/reassign-user";

    /** GET 列表；params 为“参数名, 值”交替（值原样作为查询参数，不经 URI 模板）。 */
    protected MvcResult list(long userId, Role role, String... params) throws Exception {
        MockHttpServletRequestBuilder builder = get(LIST).header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        for (int i = 0; i < params.length; i += 2) {
            builder.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(builder).andReturn();
    }

    protected MvcResult listAsSys(String... params) throws Exception {
        return list(sysAdmin, Role.SYS_ADMIN, params);
    }

    protected MvcResult listAsTennisAdmin(String... params) throws Exception {
        return list(tennisAdmin, Role.VENUE_ADMIN, params);
    }

    /** 200 响应中 items 的 id（保持顺序）。 */
    protected List<Long> itemIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).get("items").forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    protected MvcResult cancelAsSys(long id, Object body) throws Exception {
        return asSys(HttpMethod.POST, CANCEL, body, id);
    }

    protected MvcResult cancelAsTennisAdmin(long id, Object body) throws Exception {
        return asTennisAdmin(HttpMethod.POST, CANCEL, body, id);
    }

    /** 200 并返回响应体。 */
    protected JsonNode ok(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result);
    }
}
