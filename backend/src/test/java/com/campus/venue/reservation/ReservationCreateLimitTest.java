package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-03（第 7–9 步）：持有上限按有效状态计数（已越过判定点的 CONFIRMED 不算）；时段已有有效预约 → SLOT_TAKEN，
 * 已取消的不占用；第 9 步插入的字段与响应。时钟 2026-10-12 08:30:15，maxActiveReservationsPerUser = 3。
 */
@DisplayName("ACC-M3-03 创建预约九步校验：第 7–9 步")
class ReservationCreateLimitTest extends ReservationApiTestBase {

    private void holdThreeTomorrow(long userId) {
        fixtures.reservation(userId, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(userId, court1, TOMORROW, "09:30", "CONFIRMED");
        fixtures.reservation(userId, court1, TOMORROW, "11:00", "CONFIRMED");
    }

    @Test
    @DisplayName("ACC-M3-03 第 7 步：已持有 max 个 → BOOKING_LIMIT_REACHED（details.max）")
    void step7LimitReached() throws Exception {
        holdThreeTomorrow(zhangsan);

        JsonNode body = assertError(create(zhangsan, court2, TOMORROW, "14:00"), ErrorCode.BOOKING_LIMIT_REACHED);
        assertThat(body.get("details").get("max").asInt()).isEqualTo(3);
        assertThat(create(lisi, court2, TOMORROW, "14:00").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 顺序：同时违反第 7、8 步时返回第 7 步 BOOKING_LIMIT_REACHED")
    void step7BeforeStep8() throws Exception {
        holdThreeTomorrow(zhangsan);
        fixtures.reservation(lisi, court2, TOMORROW, "14:00", "CONFIRMED");

        assertError(create(zhangsan, court2, TOMORROW, "14:00"), ErrorCode.BOOKING_LIMIT_REACHED);
    }

    @Test
    @DisplayName("ACC-M3-03 第 7 步：已越过判定点的 CONFIRMED（有效状态 NO_SHOW）不计入持有数")
    void step7ExcludesConfirmedPastTheNoShowPoint() throws Exception {
        // 今天 08:00 未签到：现在 08:30:15 已晚于 08:15，有效状态为 NO_SHOW，但结束时刻 09:30 尚未到
        fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CONFIRMED");

        assertThat(create(zhangsan, court2, TOMORROW, "14:00").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 第 7 步：已签到且未结束的 CONFIRMED 计入持有数")
    void step7CountsCheckedInUnfinished() throws Exception {
        checkedIn(zhangsan, court1, TODAY, "08:00", LocalDateTime.of(TODAY, LocalTime.of(7, 50)));
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CONFIRMED");

        assertError(create(zhangsan, court2, TOMORROW, "14:00"), ErrorCode.BOOKING_LIMIT_REACHED);
    }

    @Test
    @DisplayName("ACC-M3-03 第 7 步：已结束、已取消与其他终态的预约不计入持有数")
    void step7IgnoresFinishedAndTerminal() throws Exception {
        fixtures.reservation(zhangsan, court1, TODAY.minusDays(1), "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CANCELLED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "ADMIN_CANCELLED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "11:00", "NO_SHOW");
        fixtures.reservation(zhangsan, court1, TOMORROW, "12:30", "COMPLETED");
        fixtures.reservation(zhangsan, court2, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court2, TOMORROW, "09:30", "CONFIRMED");

        assertThat(create(zhangsan, court2, TOMORROW, "14:00").getResponse().getStatus()).isEqualTo(201);
        assertError(create(zhangsan, court2, TOMORROW, "15:30"), ErrorCode.BOOKING_LIMIT_REACHED);
    }

    @Test
    @DisplayName("ACC-M3-03 第 8 步：时段已有有效预约（含 NO_SHOW、COMPLETED）→ SLOT_TAKEN")
    void step8SlotTaken() throws Exception {
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "CONFIRMED");
        fixtures.reservation(lisi, court1, TOMORROW, "11:00", "NO_SHOW");
        fixtures.reservation(lisi, court1, TOMORROW, "12:30", "COMPLETED");

        assertError(create(zhangsan, court1, TOMORROW, "09:30"), ErrorCode.SLOT_TAKEN);
        assertError(create(zhangsan, court1, TOMORROW, "11:00"), ErrorCode.SLOT_TAKEN);
        assertError(create(zhangsan, court1, TOMORROW, "12:30"), ErrorCode.SLOT_TAKEN);
        assertError(create(lisi, court1, TOMORROW, "09:30"), ErrorCode.SLOT_TAKEN);
    }

    @Test
    @DisplayName("ACC-M3-03 第 8 步：与已取消、管理员取消的预约共存时可再次预约")
    void step8CancelledReservationsDoNotOccupy() throws Exception {
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "CANCELLED");
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "ADMIN_CANCELLED");

        assertThat(create(zhangsan, court1, TOMORROW, "09:30").getResponse().getStatus()).isEqualTo(201);
        assertThat(activeCount(court1, TOMORROW, "09:30")).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-03 第 9 步：插入 CONFIRMED，结束时刻 = 开始 + 90 分钟，返回 201 Reservation")
    void step9InsertsAndReturnsTheReservation() throws Exception {
        MvcResult result = create(userBearer(zhangsan), "{\"resourceId\":" + court1
                + ",\"serviceDate\":\"2026-10-13\",\"startTime\":\"18:30\",\"purpose\":\" 周末双打 \"}");

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = json(result);
        long id = body.get("id").asLong();
        Map<String, Object> actual = objectMapper.convertValue(body, new TypeReference<>() { });
        assertThat(actual).hasSize(20).containsAllEntriesOf(Map.ofEntries(
                Map.entry("id", (int) id), Map.entry("venueId", (int) tennis), Map.entry("venueName", "网球馆"),
                Map.entry("resourceId", (int) court1), Map.entry("resourceName", "网球场1"),
                Map.entry("userId", (int) zhangsan), Map.entry("userDisplayName", "用户zhangsan"),
                Map.entry("serviceDate", "2026-10-13"), Map.entry("startTime", "18:30"),
                Map.entry("endTime", "20:00"), Map.entry("status", "CONFIRMED"),
                Map.entry("displayStatus", "UPCOMING"), Map.entry("purpose", " 周末双打 "),
                Map.entry("createdAt", "2026-10-12T08:30:15")));
        for (String nullable : new String[] {"cancelledAt", "cancelReason", "cancelledBy", "adminNote", "checkInAt",
                "checkOutAt"}) {
            assertThat(body.get(nullable).isNull()).as(nullable).isTrue();
        }
        Map<String, Object> row = jdbc.queryForMap("select user_id, end_time::text as end_time, status, purpose,"
                + " created_at::text as created_at, updated_at::text as updated_at from reservation where id = ?", id);
        assertThat(row).containsEntry("user_id", zhangsan).containsEntry("end_time", "20:00:00")
                .containsEntry("status", "CONFIRMED").containsEntry("purpose", " 周末双打 ")
                .containsEntry("created_at", "2026-10-12 08:30:15").containsEntry("updated_at", "2026-10-12 08:30:15");
    }

    @Test
    @DisplayName("ACC-M3-03 第 9 步：请求中的 userId、endTime、status 被忽略；空白 purpose 存为 NULL")
    void step9IgnoresClientControlledFields() throws Exception {
        MvcResult result = create(userBearer(zhangsan), "{\"resourceId\":" + court1 + ",\"serviceDate\":\""
                + TOMORROW + "\",\"startTime\":\"09:30\",\"purpose\":\"   \",\"userId\":" + lisi
                + ",\"endTime\":\"23:00\",\"status\":\"CANCELLED\",\"id\":424242}");

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = json(result);
        assertThat(body.get("userId").asLong()).isEqualTo(zhangsan);
        assertThat(body.get("endTime").asText()).isEqualTo("11:00");
        assertThat(body.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(body.get("purpose").isNull()).isTrue();
        assertThat(body.get("id").asLong()).isNotEqualTo(424242);
        assertThat(jdbc.queryForObject("select purpose from reservation where id = ?", String.class,
                body.get("id").asLong())).isNull();
    }
}
