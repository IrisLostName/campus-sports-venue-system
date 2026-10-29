package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/**
 * P2-2b：所有返回 Reservation / AdminReservation 的接口都带 companions（按 position，displayName 为当前显示名）；
 * 同行人自己看不到该预约（docs/03 第 2 节：预约仍只属于预约人）。
 * booked：zhangsan 今天 09:30 网球场1，名单依次为 wangwu、lisi（与 id 顺序相反，以证明按 position 排列）。
 */
@DisplayName("P2-2b 预约视图中的同行人名单")
class ReservationCompanionViewTest extends UsageApiTestBase {

    private long wangwu;
    private long booked;
    private String sys;

    @BeforeEach
    void seedBooking() {
        wangwu = user("wangwu", Role.USER);
        sys = bearer(user("sys_admin", Role.SYS_ADMIN), Role.SYS_ADMIN);
        booked = todaySlot(zhangsan);
        fixtures.companion(booked, wangwu, 1);
        fixtures.companion(booked, lisi, 2);
    }

    private JsonNode okJson(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return json(result);
    }

    private JsonNode getJson(String authorization, String url, String... params) throws Exception {
        var request = get(url).header(HttpHeaders.AUTHORIZATION, authorization);
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return okJson(mockMvc.perform(request).andReturn());
    }

    private static List<Long> companionIds(JsonNode reservation) {
        List<Long> ids = new ArrayList<>();
        reservation.get("companions").forEach(companion -> ids.add(companion.get("userId").asLong()));
        return ids;
    }

    private void assertBookedCompanions(JsonNode reservation) {
        assertThat(reservation.get("id").asLong()).isEqualTo(booked);
        assertThat(companionIds(reservation)).containsExactly(wangwu, lisi);
        assertThat(reservation.get("companions").get(1).get("displayName").asText()).isEqualTo("用户lisi");
    }

    @Test
    @DisplayName("预约人的详情与“我的预约”列表带名单")
    void ownerDetailAndList() throws Exception {
        assertBookedCompanions(okJson(detail(userBearer(zhangsan), booked)));

        JsonNode items = getJson(userBearer(zhangsan), RESERVATIONS + "/me").get("items");
        assertThat(items).hasSize(1);
        assertBookedCompanions(items.get(0));
    }

    @Test
    @DisplayName("管理端预约列表与详情带名单")
    void adminListAndDetail() throws Exception {
        JsonNode items = getJson(sys, "/api/v1/admin/reservations").get("items");
        assertThat(items).hasSize(1);
        assertBookedCompanions(items.get(0));

        assertBookedCompanions(okJson(detail(sys, booked)));
    }

    @Test
    @DisplayName("扫码签到返回的 AdminReservation 与签退返回的 Reservation 带名单")
    void scanCheckInAndCheckOut() throws Exception {
        clock.setLocal(today(9, 20, 0));
        assertBookedCompanions(okJson(scan(sys, codeOf(booked))));

        clock.setLocal(today(10, 0, 0));
        assertBookedCompanions(okJson(checkOut(zhangsan, booked)));
    }

    @Test
    @DisplayName("用户取消返回的 Reservation 带名单；名单在取消后保留")
    void cancelKeepsTheList() throws Exception {
        long tomorrow = fixtures.reservation(zhangsan, court2, TOMORROW, SLOT, "CONFIRMED");
        fixtures.companion(tomorrow, lisi, 1);

        JsonNode cancelled = okJson(cancel(zhangsan, tomorrow, null));

        assertThat(cancelled.get("status").asText()).isEqualTo("CANCELLED");
        assertThat(companionIds(cancelled)).containsExactly(lisi);
    }

    @Test
    @DisplayName("没有同行人的预约返回空数组；displayName 取当前显示名")
    void emptyListAndLiveDisplayName() throws Exception {
        long alone = fixtures.reservation(lisi, court2, TOMORROW, SLOT, "CONFIRMED");
        JsonNode lonely = okJson(detail(userBearer(lisi), alone));
        assertThat(lonely.get("companions").isArray()).isTrue();
        assertThat(lonely.get("companions")).isEmpty();

        jdbc.update("update app_user set display_name = '李四' where id = ?", lisi);
        assertThat(okJson(detail(userBearer(zhangsan), booked)).get("companions").get(1).get("displayName").asText())
                .isEqualTo("李四");
    }

    @Test
    @DisplayName("同行人自己的“我的预约”看不到该预约；查看详情得 NOT_OWNER；不能取消")
    void companionDoesNotOwnTheReservation() throws Exception {
        for (String scope : List.of("ALL", "CURRENT")) {
            JsonNode page = getJson(userBearer(lisi), RESERVATIONS + "/me", "scope", scope);
            assertThat(page.get("total").asInt()).as(scope).isZero();
        }
        assertError(detail(userBearer(lisi), booked), ErrorCode.NOT_OWNER);
        assertError(cancel(lisi, booked, null), ErrorCode.NOT_OWNER);
    }
}
