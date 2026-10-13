package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-05：POST /reservations/{id}/check-in（docs/10 第 4 节，BE-4 I1–I4、T2、T3）。认证 → 格式 → 角色 USER
 * → NOT_FOUND → NOT_OWNER → INVALID_STATE（有效状态）→ CHECKIN_WINDOW_CLOSED（闭区间）→ ALREADY_CHECKED_IN。
 */
@DisplayName("ACC-M3-05 签到")
class ReservationCheckInApiTest extends UsageApiTestBase {

    @Test
    @DisplayName("ACC-M3-05 窗口开启时刻正好（开始前 15 分钟）签到成功：IN_USE、checkInAt 取时钟、写入使用记录")
    void checkInExactlyWhenTheWindowOpens() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 15, 0));

        MvcResult result = checkIn(zhangsan, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("id").asLong()).isEqualTo(id);
        assertThat(body.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(body.get("checkInAt").asText()).isEqualTo("2026-10-12T09:15:00");
        assertThat(body.get("checkOutAt").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select check_in_at::text from usage_record where reservation_id = ?"
                + " and check_out_at is null", String.class, id)).isEqualTo("2026-10-12 09:15:00");
        assertThat(status(id)).isEqualTo("CONFIRMED");
    }

    @Test
    @DisplayName("ACC-M3-05 窗口开启前 1 秒：CHECKIN_WINDOW_CLOSED，details 带 opensAt、closesAt，不写使用记录")
    void oneSecondBeforeTheWindowOpensIsClosed() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 14, 59));

        JsonNode body = assertError(checkIn(zhangsan, id), ErrorCode.CHECKIN_WINDOW_CLOSED);

        assertThat(body.get("details").get("opensAt").asText()).isEqualTo("2026-10-12T09:15:00");
        assertThat(body.get("details").get("closesAt").asText()).isEqualTo("2026-10-12T09:45:00");
        assertThat(usageCount(id)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 窗口关闭时刻正好（开始后 15 分钟）签到成功")
    void checkInExactlyWhenTheWindowCloses() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 45, 0));

        MvcResult result = checkIn(zhangsan, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(result).get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(json(result).get("checkInAt").asText()).isEqualTo("2026-10-12T09:45:00");
        assertThat(usageCount(id)).isEqualTo(1);
    }

    @Test
    @DisplayName("ACC-M3-05 I2：窗口关闭后 1 秒有效状态为 NO_SHOW → INVALID_STATE {status: NO_SHOW}，库中不变")
    void oneSecondAfterTheWindowClosesIsNoShow() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 45, 1));

        JsonNode body = assertError(checkIn(zhangsan, id), ErrorCode.INVALID_STATE);

        assertThat(body.get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(usageCount(id)).isZero();
        assertThat(status(id)).isEqualTo("CONFIRMED");
    }

    @Test
    @DisplayName("ACC-M3-05 已签到后在窗口内再签到：ALREADY_CHECKED_IN，使用记录仍为 1 条且签到时间不变")
    void secondCheckInInsideTheWindowIsAlreadyCheckedIn() throws Exception {
        long id = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));
        clock.setLocal(today(9, 25, 0));

        assertError(checkIn(zhangsan, id), ErrorCode.ALREADY_CHECKED_IN);
        assertThat(jdbc.queryForObject("select check_in_at::text from usage_record where reservation_id = ?",
                String.class, id)).isEqualTo("2026-10-12 09:20:00");
    }

    @Test
    @DisplayName("ACC-M3-05 顺序：已签到后在窗口外（结束前）再签到，窗口检查先于已签到 → CHECKIN_WINDOW_CLOSED")
    void secondCheckInOutsideTheWindowIsWindowClosed() throws Exception {
        long id = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));
        clock.setLocal(today(9, 50, 0));

        JsonNode body = assertError(checkIn(zhangsan, id), ErrorCode.CHECKIN_WINDOW_CLOSED);

        assertThat(body.get("details").get("opensAt").asText()).isEqualTo("2026-10-12T09:15:00");
        assertThat(body.get("details").get("closesAt").asText()).isEqualTo("2026-10-12T09:45:00");
    }

    @Test
    @DisplayName("ACC-M3-05 已签到且已结束：有效状态 COMPLETED → INVALID_STATE")
    void checkedInAndEndedIsInvalidState() throws Exception {
        long id = checkedIn(zhangsan, court1, TODAY, SLOT, today(9, 20, 0));
        clock.setLocal(today(11, 0, 0));

        assertThat(assertError(checkIn(zhangsan, id), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("ACC-M3-05 INVALID_STATE：已取消、管理员取消、NO_SHOW（窗口内也拒绝），details.status 为该状态")
    void terminalStatusesAreInvalidState() throws Exception {
        long cancelled = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "CANCELLED");
        long adminCancelled = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "ADMIN_CANCELLED");
        long noShow = fixtures.reservation(zhangsan, court2, TODAY, SLOT, "NO_SHOW");
        clock.setLocal(today(9, 20, 0));

        assertThat(assertError(checkIn(zhangsan, cancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("CANCELLED");
        assertThat(assertError(checkIn(zhangsan, adminCancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(assertError(checkIn(zhangsan, noShow), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(jdbc.queryForObject("select count(*) from usage_record", Integer.class)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 认证 → 格式 → 角色（VA、SA 为 FORBIDDEN）→ NOT_FOUND")
    void authenticationFormatRoleThenNotFound() throws Exception {
        long id = todaySlot(zhangsan);
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        clock.setLocal(today(9, 20, 0));

        assertError(mockMvc.perform(post(RESERVATIONS + "/{id}/check-in", id)).andReturn(), ErrorCode.AUTH_REQUIRED);
        assertError(checkIn(userBearer(zhangsan), "abc"), ErrorCode.VALIDATION_ERROR);
        assertError(checkIn(bearer(venueAdmin, Role.VENUE_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(checkIn(bearer(sysAdmin, Role.SYS_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(checkIn(zhangsan, 999_999), ErrorCode.NOT_FOUND);
        assertThat(usageCount(id)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 NOT_OWNER 先于状态与窗口：他人的待签到预约、他人已签到的预约")
    void notOwnerPrecedesStateAndWindow() throws Exception {
        long open = todaySlot(zhangsan);
        long taken = checkedIn(zhangsan, court2, TODAY, SLOT, today(9, 16, 0));
        long future = fixtures.reservation(zhangsan, court1, TOMORROW, SLOT, "CONFIRMED");
        clock.setLocal(today(9, 20, 0));

        assertError(checkIn(lisi, open), ErrorCode.NOT_OWNER);
        assertError(checkIn(lisi, taken), ErrorCode.NOT_OWNER);
        assertError(checkIn(lisi, future), ErrorCode.NOT_OWNER);
        assertThat(usageCount(open)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 I1：请求体被忽略，带了 JSON 也照常签到")
    void requestBodyIsIgnored() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 30, 0));

        MvcResult result = mockMvc.perform(post(RESERVATIONS + "/{id}/check-in", id)
                .header(HttpHeaders.AUTHORIZATION, userBearer(zhangsan))
                .contentType(MediaType.APPLICATION_JSON).content("{\"checkInAt\":\"2026-10-12T08:00:00\"}"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(json(result).get("checkInAt").asText()).isEqualTo("2026-10-12T09:30:00");
    }
}
