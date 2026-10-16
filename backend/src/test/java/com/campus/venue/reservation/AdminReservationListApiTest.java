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
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 A1、T5：GET /admin/reservations 的范围、格式、响应形状、排序与分页（docs/12 第 5.7 节）。
 * 过滤条件（日期、有效状态、关键字）见 AdminReservationListFilterTest。
 */
class AdminReservationListApiTest extends AdminReservationApiTestBase {

    private static final List<String> RESERVATION_KEYS = List.of("id", "venueId", "venueName", "resourceId",
            "resourceName", "userId", "userDisplayName", "serviceDate", "startTime", "endTime", "status",
            "displayStatus", "purpose", "createdAt", "cancelledAt", "cancelReason", "cancelledBy", "adminNote",
            "checkInAt", "checkOutAt");

    private long tennisBooking;
    private long badmintonBooking;

    @BeforeEach
    void seedReservations() {
        tennisBooking = reservation(zhangsan, court1, TOMORROW, "09:30");
        badmintonBooking = reservation(lisi, badmintonCourt, TOMORROW, "09:30");
    }

    private void assertField(MvcResult result, String field, String message) throws Exception {
        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get(field).asText()).isEqualTo(message);
    }

    @Test
    @DisplayName("ACC-M3-07 VENUE_ADMIN 未给 venueId 只见授权场馆；SYS_ADMIN 见全部")
    void venueAdminSeesOnlyAuthorizedVenues() throws Exception {
        assertThat(itemIds(listAsTennisAdmin())).containsExactly(tennisBooking);
        assertThat(json(listAsTennisAdmin()).get("total").asLong()).isEqualTo(1);
        assertThat(itemIds(listAsSys())).containsExactlyInAnyOrder(tennisBooking, badmintonBooking);
        assertThat(itemIds(listAsSys("venueId", String.valueOf(badminton)))).containsExactly(badmintonBooking);
    }

    @Test
    @DisplayName("ACC-M3-07 venueId 越权或不存在：VENUE_ADMIN 得 FORBIDDEN_SCOPE {venueId}；SYS_ADMIN 传不存在的场馆得空页")
    void venueIdOutsideScopeIsForbiddenScope() throws Exception {
        JsonNode body = assertError(listAsTennisAdmin("venueId", String.valueOf(badminton)),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(badminton);
        assertThat(assertError(listAsTennisAdmin("venueId", "999999"), ErrorCode.FORBIDDEN_SCOPE)
                .get("details").get("venueId").asLong()).isEqualTo(999999);

        JsonNode page = ok(listAsSys("venueId", "999999"));
        assertThat(page.get("items")).isEmpty();
        assertThat(page.get("total").asLong()).isZero();
    }

    @Test
    @DisplayName("没有任何有效授权的 VENUE_ADMIN 得空页")
    void venueAdminWithoutScopesGetsAnEmptyPage() throws Exception {
        long other = user("admin_other", Role.VENUE_ADMIN);

        JsonNode page = ok(list(other, Role.VENUE_ADMIN));

        assertThat(page.get("items")).isEmpty();
        assertThat(page.get("total").asLong()).isZero();
    }

    @Test
    @DisplayName("P2 AdminReservation 为扁平 JSON：Reservation 全部字段 + userUsername、userPhone，无嵌套 reservation，空 userPhone 为 null")
    void itemsAreFlatAdminReservations() throws Exception {
        jdbc.update("update app_user set phone = '13800000001' where id = ?", zhangsan);

        JsonNode items = ok(listAsSys()).get("items");

        List<String> expected = new ArrayList<>(RESERVATION_KEYS);
        expected.addAll(List.of("userUsername", "userPhone"));
        for (JsonNode item : items) {
            List<String> keys = new ArrayList<>();
            item.fieldNames().forEachRemaining(keys::add);
            assertThat(keys).containsExactlyInAnyOrderElementsOf(expected).doesNotContain("reservation");
        }
        JsonNode zhang = items.get(0).get("id").asLong() == tennisBooking ? items.get(0) : items.get(1);
        JsonNode li = zhang == items.get(0) ? items.get(1) : items.get(0);
        assertThat(zhang.get("userUsername").asText()).isEqualTo("zhangsan");
        assertThat(zhang.get("userPhone").asText()).isEqualTo("13800000001");
        assertThat(zhang.get("userDisplayName").asText()).isEqualTo("用户zhangsan");
        assertThat(zhang.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(zhang.get("resourceName").asText()).isEqualTo("网球场1");
        assertThat(zhang.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(zhang.get("displayStatus").asText()).isEqualTo("UPCOMING");
        assertThat(zhang.get("serviceDate").asText()).isEqualTo(TOMORROW.toString());
        assertThat(zhang.get("startTime").asText()).isEqualTo("09:30");
        assertThat(zhang.get("endTime").asText()).isEqualTo("11:00");
        assertThat(li.get("userUsername").asText()).isEqualTo("lisi");
        assertThat(li.has("userPhone")).isTrue();
        assertThat(li.get("userPhone").isNull()).isTrue();
        assertThat(li.get("adminNote").isNull()).isTrue();
    }

    @Test
    @DisplayName("排序：服务日期、开始时间、id 均倒序")
    void itemsAreNewestFirst() throws Exception {
        long sameSlotLater = reservation(lisi, court2, TOMORROW, "09:30");
        long laterStart = reservation(lisi, court1, TOMORROW, "11:00");
        long laterDay = reservation(lisi, court1, TOMORROW.plusDays(1), "08:00");
        long earlierDay = reservation(lisi, court1, TODAY, "18:00");

        assertThat(itemIds(listAsTennisAdmin()))
                .containsExactly(laterDay, laterStart, sameSlotLater, tennisBooking, earlierDay);
    }

    @Test
    @DisplayName("分页：page、pageSize 生效，total 为总数；越界页与超大页码得空 items 与真实 total，不得 500")
    void pagingBoundaries() throws Exception {
        long second = reservation(lisi, court2, TOMORROW, "09:30");
        long third = reservation(lisi, court3, TOMORROW, "09:30");

        JsonNode first = ok(listAsTennisAdmin("page", "1", "pageSize", "2"));
        assertThat(first.get("page").asInt()).isEqualTo(1);
        assertThat(first.get("pageSize").asInt()).isEqualTo(2);
        assertThat(first.get("total").asLong()).isEqualTo(3);
        assertThat(itemIds(listAsTennisAdmin("page", "1", "pageSize", "2"))).containsExactly(third, second);
        assertThat(itemIds(listAsTennisAdmin("page", "2", "pageSize", "2"))).containsExactly(tennisBooking);
        for (String page : new String[] {"3", "2147483647"}) {
            JsonNode empty = ok(listAsTennisAdmin("page", page, "pageSize", "100"));
            assertThat(empty.get("items")).isEmpty();
            assertThat(empty.get("total").asLong()).isEqualTo(3);
        }
        JsonNode defaults = ok(listAsTennisAdmin());
        assertThat(defaults.get("page").asInt()).isEqualTo(1);
        assertThat(defaults.get("pageSize").asInt()).isEqualTo(20);
    }

    @Test
    @DisplayName("格式：venueId、日期、status、keyword、page、pageSize 不合法 → VALIDATION_ERROR 指明参数")
    void malformedParametersAreValidationErrors() throws Exception {
        assertField(listAsSys("venueId", "0"), "venueId", "应为正整数");
        assertField(listAsSys("venueId", "abc"), "venueId", "类型不符");
        assertField(listAsSys("dateFrom", "2026-02-30"), "dateFrom", "类型不符");
        assertField(listAsSys("dateTo", "2026-1-5"), "dateTo", "类型不符");
        assertField(listAsSys("status", "PENDING"), "status",
                "应为 CONFIRMED/COMPLETED/CANCELLED/ADMIN_CANCELLED/NO_SHOW 之一");
        assertField(listAsSys("keyword", "k".repeat(51)), "keyword", "不能超过 50 个字符");
        assertField(listAsSys("page", "0"), "page", "应为不小于 1 的整数");
        assertField(listAsSys("pageSize", "101"), "pageSize", "应为 1–100 的整数");
        assertField(listAsSys("keyword", "a\u0000b"), "keyword", "不能包含 U+0000 字符");
        assertThat(itemIds(listAsSys("keyword", "k".repeat(50)))).isEmpty();
    }

    @Test
    @DisplayName("阶段顺序：未登录 401 → 格式先于角色（USER 带错参数得 VALIDATION_ERROR）→ USER 得 FORBIDDEN")
    void authenticationThenFormatThenRole() throws Exception {
        assertError(mockMvc.perform(get(LIST)).andReturn(), ErrorCode.AUTH_REQUIRED);
        assertField(list(zhangsan, Role.USER, "venueId", "-1"), "venueId", "应为正整数");
        assertError(list(zhangsan, Role.USER), ErrorCode.FORBIDDEN);
        assertError(list(zhangsan, Role.USER, "venueId", String.valueOf(tennis)), ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("读取接口不写库：库中 CONFIRMED 而有效状态为 NO_SHOW 的记录响应为 NO_SHOW，库中仍为 CONFIRMED")
    void listingDoesNotWrite() throws Exception {
        long overdue = reservation(zhangsan, court2, TODAY, "08:00");

        JsonNode items = ok(listAsSys("status", "NO_SHOW")).get("items");

        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("id").asLong()).isEqualTo(overdue);
        assertThat(items.get(0).get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(reservationStatus(overdue)).isEqualTo("CONFIRMED");
        assertThat(logCount()).isZero();
    }
}
