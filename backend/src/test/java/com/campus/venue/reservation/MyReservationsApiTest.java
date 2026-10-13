package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * T5：GET /reservations/me（BE-3 M1–M3）。时钟 2026-10-12 08:30:15。zhangsan 的 7 条预约：
 * 当前持有 = 今天 08:00 已签到（IN_USE）、明天 08:00、明天 09:30；
 * 其余 = 今天 08:00 未签到（已过签到窗口，有效状态 NO_SHOW）、明天 11:00 已取消、昨天 09:30 COMPLETED、昨天 09:30 未签到 CONFIRMED。
 */
class MyReservationsApiTest extends ReservationApiTestBase {

    private long checkedInToday;
    private long tomorrow0800;
    private long tomorrow0930;
    private long staleToday;
    private long cancelledTomorrow;
    private long completedYesterday;
    private long staleYesterday;

    @BeforeEach
    void seedReservations() {
        checkedInToday = checkedIn(zhangsan, court1, TODAY, "08:00", LocalDateTime.of(TODAY, LocalTime.of(7, 50)));
        tomorrow0930 = fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CONFIRMED");
        tomorrow0800 = fixtures.reservation(zhangsan, court2, TOMORROW, "08:00", "CONFIRMED");
        staleToday = fixtures.reservation(zhangsan, court2, TODAY, "08:00", "CONFIRMED");
        cancelledTomorrow = fixtures.reservation(zhangsan, court1, TOMORROW, "11:00", "CANCELLED");
        completedYesterday = fixtures.reservation(zhangsan, court1, TODAY.minusDays(1), "09:30", "COMPLETED");
        staleYesterday = fixtures.reservation(zhangsan, court2, TODAY.minusDays(1), "09:30", "CONFIRMED");
        fixtures.reservation(lisi, court2, TOMORROW, "09:30", "CONFIRMED");
    }

    private MvcResult mine(long userId, Role role, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get(RESERVATIONS + "/me")
                .header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(request).andReturn();
    }

    private JsonNode page(String... params) throws Exception {
        MvcResult result = mine(zhangsan, Role.USER, params);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json(result);
    }

    private static List<Long> ids(JsonNode page) {
        List<Long> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("id").asLong()));
        return ids;
    }

    @Test
    void currentIsHeldReservationsInAscendingOrder() throws Exception {
        JsonNode body = page("scope", "CURRENT");

        assertThat(ids(body)).containsExactly(checkedInToday, tomorrow0800, tomorrow0930);
        assertThat(body.get("total").asLong()).isEqualTo(3);
        assertThat(body.get("items").get(0).get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(body.get("items").get(0).get("checkInAt").asText()).isEqualTo("2026-10-12T07:50:00");
    }

    @Test
    void historyIsEverythingElseNewestFirstWithIdAsTieBreak() throws Exception {
        JsonNode body = page("scope", "HISTORY");

        assertThat(ids(body)).containsExactly(cancelledTomorrow, staleToday, staleYesterday, completedYesterday);
        assertThat(body.get("total").asLong()).isEqualTo(4);
    }

    @Test
    void confirmedPastTheDecisionPointIsHistoryWithEffectiveStatus() throws Exception {
        JsonNode stale = page("scope", "HISTORY").get("items").get(1);

        assertThat(stale.get("id").asLong()).isEqualTo(staleToday);
        assertThat(stale.get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(stale.get("displayStatus").asText()).isEqualTo("NO_SHOW");
        // 读取接口不写库
        assertThat(jdbc.queryForObject("select status from reservation where id = ?", String.class, staleToday))
                .isEqualTo("CONFIRMED");
    }

    @Test
    void allIsEverythingNewestFirstAndIsTheDefault() throws Exception {
        List<Long> expected = List.of(cancelledTomorrow, tomorrow0930, tomorrow0800, staleToday, checkedInToday,
                staleYesterday, completedYesterday);

        assertThat(ids(page("scope", "ALL"))).containsExactlyElementsOf(expected);
        JsonNode defaults = page();
        assertThat(ids(defaults)).containsExactlyElementsOf(expected);
        assertThat(defaults.get("page").asInt()).isEqualTo(1);
        assertThat(defaults.get("pageSize").asInt()).isEqualTo(20);
        assertThat(defaults.get("total").asLong()).isEqualTo(7);
    }

    @Test
    void pagingBoundariesInTheDatabase() throws Exception {
        assertThat(ids(page("pageSize", "3", "page", "3"))).containsExactly(completedYesterday);
        JsonNode beyond = page("pageSize", "3", "page", "4");
        assertThat(beyond.get("items")).isEmpty();
        assertThat(beyond.get("total").asLong()).isEqualTo(7);
        assertThat(beyond.get("page").asInt()).isEqualTo(4);
        assertThat(ids(page("scope", "HISTORY", "pageSize", "2", "page", "2")))
                .containsExactly(staleYesterday, completedYesterday);
        assertThat(ids(page("pageSize", "100"))).hasSize(7);
        assertThat(ids(page("page", "", "pageSize", "1"))).containsExactly(cancelledTomorrow);
    }

    @Test
    void pagingBoundariesOfCurrent() throws Exception {
        JsonNode second = page("scope", "CURRENT", "pageSize", "2", "page", "2");
        assertThat(ids(second)).containsExactly(tomorrow0930);
        assertThat(second.get("total").asLong()).isEqualTo(3);
        JsonNode beyond = page("scope", "CURRENT", "pageSize", "2", "page", "5");
        assertThat(beyond.get("items")).isEmpty();
        assertThat(beyond.get("total").asLong()).isEqualTo(3);
    }

    /** BE-3 审计 F1：偏移超出 int 的超大页码返回 200 空页、total 照实，不得 500。 */
    @Test
    void hugePageNumberOfAllIsAnEmptyPageWithTheRealTotal() throws Exception {
        JsonNode body = page("scope", "ALL", "page", "2147483647", "pageSize", "100");
        assertThat(body.get("items")).isEmpty();
        assertThat(body.get("total").asLong()).isEqualTo(7);
        assertThat(body.get("page").asInt()).isEqualTo(Integer.MAX_VALUE);
        assertThat(body.get("pageSize").asInt()).isEqualTo(100);
    }

    @Test
    void hugePageNumberOfHistoryIsAnEmptyPageWithTheRealTotal() throws Exception {
        JsonNode body = page("scope", "HISTORY", "page", "2147483647", "pageSize", "100");
        assertThat(body.get("items")).isEmpty();
        assertThat(body.get("total").asLong()).isEqualTo(4);
        assertThat(body.get("page").asInt()).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void userWithoutReservationsGetsAnEmptyPage() throws Exception {
        JsonNode body = json(mine(user("wangwu", Role.USER), Role.USER));

        assertThat(body.get("items")).isEmpty();
        assertThat(body.get("total").asLong()).isZero();
    }

    @ParameterizedTest
    @CsvSource({"scope,FUTURE", "scope,current", "scope,''", "page,0", "page,abc", "pageSize,0", "pageSize,101",
            "pageSize,1.5"})
    void invalidParametersAreNamed(String name, String value) throws Exception {
        JsonNode body = assertError(mine(zhangsan, Role.USER, name, value), ErrorCode.VALIDATION_ERROR);

        assertThat(body.get("details").get("fields").has(name)).isTrue();
    }

    @Test
    void scopeMessageMatchesTheMock() throws Exception {
        JsonNode body = assertError(mine(zhangsan, Role.USER, "scope", "FUTURE"), ErrorCode.VALIDATION_ERROR);

        assertThat(body.get("details").get("fields").get("scope").asText()).isEqualTo("应为 CURRENT/HISTORY/ALL 之一");
    }

    @Test
    void formatIsCheckedBeforeRoleAndAdminsAreForbidden() throws Exception {
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);

        assertError(mine(venueAdmin, Role.VENUE_ADMIN, "scope", "FUTURE"), ErrorCode.VALIDATION_ERROR);
        assertError(mine(venueAdmin, Role.VENUE_ADMIN), ErrorCode.FORBIDDEN);
        assertError(mine(sysAdmin, Role.SYS_ADMIN), ErrorCode.FORBIDDEN);
    }

    /** BE-3 G4：字符串查询参数中的 U+0000 → fields.scope；未登录时仍先得 AUTH_REQUIRED。 */
    @Test
    void nulInScopeIsRejectedAfterAuthentication() throws Exception {
        JsonNode body = assertError(mine(zhangsan, Role.USER, "scope", "CURRENT\u0000"), ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("scope").asText()).isEqualTo("不能包含 U+0000 字符");

        assertError(mockMvc.perform(get(RESERVATIONS + "/me").param("scope", "\u0000")).andReturn(),
                ErrorCode.AUTH_REQUIRED);
    }
}
