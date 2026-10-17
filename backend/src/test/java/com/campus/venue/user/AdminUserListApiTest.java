package com.campus.venue.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** BE-6 U1、T5：系统管理员的用户列表（过滤、关键字字面匹配、venueIds、分页）。 */
class AdminUserListApiTest extends AdminUserApiTestBase {

    /** params 为“参数名, 值”交替（值原样作为查询参数，不经 URI 模板编码）。 */
    private MvcResult listAs(long userId, Role role, String... params) throws Exception {
        MockHttpServletRequestBuilder builder = get(USERS).header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        for (int i = 0; i < params.length; i += 2) {
            builder.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(builder).andReturn();
    }

    private MvcResult listAsSys(String... params) throws Exception {
        return listAs(sysAdmin, Role.SYS_ADMIN, params);
    }

    @Test
    @DisplayName("U1 按 id 升序；role 过滤；VENUE_ADMIN 的 venueIds 为当前有效授权（升序），其他角色为 null")
    void listsUsersByIdWithEffectiveVenueIds() throws Exception {
        long other = user("admin_both", Role.VENUE_ADMIN);
        fixtures.grant(other, badminton, sysAdmin);
        fixtures.grant(other, tennis, sysAdmin);
        long revoked = user("admin_gone", Role.VENUE_ADMIN);
        fixtures.grant(revoked, tennis, "REVOKED", null, null, sysAdmin);
        fixtures.grant(revoked, badminton, "ACTIVE", TODAY.plusDays(1), null, sysAdmin);

        JsonNode page = json(listAsSys());
        assertThat(pageIds(listAsSys())).containsExactly(sysAdmin, tennisAdmin, zhangsan, lisi, other, revoked);
        assertThat(page.get("total").asLong()).isEqualTo(6);
        assertThat(page.get("items").get(0).get("venueIds").isNull()).isTrue();
        assertThat(page.get("items").get(1).get("venueIds").toString()).isEqualTo("[" + tennis + "]");
        assertThat(page.get("items").get(4).get("venueIds").toString())
                .isEqualTo("[" + tennis + "," + badminton + "]");
        assertThat(page.get("items").get(5).get("venueIds").toString()).isEqualTo("[]");
        List<String> keys = new ArrayList<>();
        page.get("items").get(0).fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactly("id", "username", "displayName", "role", "userType", "phone", "status",
                "venueIds");

        assertThat(pageIds(listAsSys("role", "VENUE_ADMIN"))).containsExactly(tennisAdmin, other, revoked);
        assertThat(pageIds(listAsSys("role", "USER"))).containsExactly(zhangsan, lisi);
    }

    @Test
    @DisplayName("U1 keyword：去首尾空白、不区分大小写、匹配用户名或姓名；%、_、反斜杠按字面；空白视为未填")
    void keywordIsALiteralCaseInsensitiveContainsMatch() throws Exception {
        long percent = TestUsers.insert(jdbc, "pct_user", Role.USER);
        jdbc.update("update app_user set display_name = '百分之100%' where id = ?", percent);
        long slash = TestUsers.insert(jdbc, "slashy", Role.USER);
        jdbc.update("update app_user set display_name = 'a\\\\b' where id = ?", slash);
        long upper = TestUsers.insert(jdbc, "MixedCase", Role.USER);

        assertThat(pageIds(listAsSys("keyword", " ZHANG "))).containsExactly(zhangsan);
        assertThat(pageIds(listAsSys("keyword", "mixedc"))).containsExactly(upper);
        assertThat(pageIds(listAsSys("keyword", "100%"))).containsExactly(percent);
        assertThat(pageIds(listAsSys("keyword", "%"))).containsExactly(percent);
        assertThat(pageIds(listAsSys("keyword", "_"))).containsExactly(tennisAdmin, percent);
        assertThat(pageIds(listAsSys("keyword", "\\"))).containsExactly(slash);
        assertThat(pageIds(listAsSys("keyword", "用户li"))).containsExactly(lisi);
        assertThat(pageIds(listAsSys("keyword", "  "))).hasSize(7);
    }

    @Test
    @DisplayName("U1 分页：page、pageSize；超大页码得空页；格式（role、keyword 长度、分页）先于角色")
    void pagingAndValidation() throws Exception {
        JsonNode second = json(listAsSys("pageSize", "3", "page", "2"));
        assertThat(second.get("items")).hasSize(1);
        assertThat(second.get("pageSize").asInt()).isEqualTo(3);
        assertThat(second.get("total").asLong()).isEqualTo(4);
        assertThat(json(listAsSys("page", "2147483647", "pageSize", "100")).get("items")).isEmpty();

        JsonNode error = assertError(listAs(zhangsan, Role.USER, "role", "ADMIN", "keyword", "k".repeat(51),
                "page", "0", "pageSize", "101"), ErrorCode.VALIDATION_ERROR);
        assertThat(fields(error).get("role").asText()).isEqualTo("应为 USER/VENUE_ADMIN/SYS_ADMIN 之一");
        assertThat(fields(error).get("keyword").asText()).isEqualTo("不能超过 50 个字符");
        assertThat(fields(error).get("page").asText()).isEqualTo("应为不小于 1 的整数");
        assertThat(fields(error).get("pageSize").asText()).isEqualTo("应为 1–100 的整数");
    }
}
