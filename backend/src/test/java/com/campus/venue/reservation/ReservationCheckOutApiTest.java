package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-05：POST /reservations/{id}/check-out（docs/10 第 4 节，BE-4 O1、O2、T2、T3）。认证 → 格式 → 角色 USER
 * → NOT_FOUND → NOT_OWNER → INVALID_STATE（有效状态既非 CONFIRMED 也非 COMPLETED）→ NOT_CHECKED_IN
 * → ALREADY_CHECKED_OUT → 现在 ≥ 结束 + checkOutGraceMinutes 为 INVALID_STATE（严格小于才允许）。
 */
@DisplayName("ACC-M3-05 签退")
class ReservationCheckOutApiTest extends UsageApiTestBase {

    /** 今天 09:30–11:00 场地 resourceId 上 zhangsan 已于 09:20 签到的预约。 */
    private long checkedInToday(long resourceId) {
        return checkedIn(zhangsan, resourceId, TODAY, SLOT, today(9, 20, 0));
    }

    private String checkOutAt(long id) {
        return jdbc.queryForObject("select check_out_at::text from usage_record where reservation_id = ?",
                String.class, id);
    }

    @Test
    @DisplayName("ACC-M3-05 结束前签退：CHECKED_OUT，checkOutAt 取时钟，库中只写 check_out_at")
    void checkOutBeforeTheEndIsCheckedOut() throws Exception {
        long id = checkedInToday(court1);
        clock.setLocal(today(10, 59, 59));

        MvcResult result = checkOut(zhangsan, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("CHECKED_OUT");
        assertThat(body.get("checkInAt").asText()).isEqualTo("2026-10-12T09:20:00");
        assertThat(body.get("checkOutAt").asText()).isEqualTo("2026-10-12T10:59:59");
        assertThat(checkOutAt(id)).isEqualTo("2026-10-12 10:59:59");
        assertThat(status(id)).isEqualTo("CONFIRMED");
    }

    @Test
    @DisplayName("ACC-M3-05 结束时刻正好签退：有效状态与展示状态均为 COMPLETED")
    void checkOutAtTheEndIsCompleted() throws Exception {
        long id = checkedInToday(court1);
        clock.setLocal(today(11, 0, 0));

        JsonNode body = json(checkOut(zhangsan, id));

        assertThat(body.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("COMPLETED");
        assertThat(body.get("checkOutAt").asText()).isEqualTo("2026-10-12T11:00:00");
        assertThat(checkOutAt(id)).isEqualTo("2026-10-12 11:00:00");
    }

    @Test
    @DisplayName("ACC-M3-05 宽限截止前 1 秒签退成功；正好截止（结束 + 30 分钟）→ INVALID_STATE，不写签退时间")
    void graceDeadlineIsExclusive() throws Exception {
        long early = checkedInToday(court1);
        long exact = checkedInToday(court2);

        clock.setLocal(today(11, 29, 59));
        assertThat(checkOut(zhangsan, early).getResponse().getStatus()).isEqualTo(200);
        assertThat(checkOutAt(early)).isEqualTo("2026-10-12 11:29:59");

        clock.setLocal(today(11, 30, 0));
        JsonNode body = assertError(checkOut(zhangsan, exact), ErrorCode.INVALID_STATE);
        assertThat(body.get("details").get("status").asText()).isEqualTo("COMPLETED");
        assertThat(checkOutAt(exact)).isNull();
    }

    @Test
    @DisplayName("ACC-M3-05 库中已落库为 COMPLETED 的预约在宽限内仍可签退")
    void storedCompletedCanStillCheckOutWithinGrace() throws Exception {
        long id = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "COMPLETED");
        fixtures.usage(id, today(9, 20, 0), null);
        clock.setLocal(today(11, 10, 0));

        JsonNode body = json(checkOut(zhangsan, id));

        assertThat(body.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(body.get("checkOutAt").asText()).isEqualTo("2026-10-12T11:10:00");
    }

    @Test
    @DisplayName("ACC-M3-05 NOT_CHECKED_IN：未来的预约、签到窗口内尚未签到的预约")
    void withoutUsageIsNotCheckedIn() throws Exception {
        long future = fixtures.reservation(zhangsan, court1, TOMORROW, SLOT, "CONFIRMED");
        long open = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));

        assertError(checkOut(zhangsan, future), ErrorCode.NOT_CHECKED_IN);
        assertError(checkOut(zhangsan, open), ErrorCode.NOT_CHECKED_IN);
        assertThat(usageCount(future) + usageCount(open)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-05 ALREADY_CHECKED_OUT 先于宽限检查：已签退的预约在宽限内外都是 ALREADY_CHECKED_OUT")
    void alreadyCheckedOutPrecedesTheGraceCheck() throws Exception {
        long id = fixtures.reservation(zhangsan, court1, TODAY, SLOT, "CONFIRMED");
        fixtures.usage(id, today(9, 20, 0), today(10, 30, 0));

        clock.setLocal(today(10, 40, 0));
        assertError(checkOut(zhangsan, id), ErrorCode.ALREADY_CHECKED_OUT);
        clock.setLocal(today(12, 0, 0));
        assertError(checkOut(zhangsan, id), ErrorCode.ALREADY_CHECKED_OUT);
        assertThat(checkOutAt(id)).isEqualTo("2026-10-12 10:30:00");
    }

    @Test
    @DisplayName("ACC-M3-05 INVALID_STATE 先于 NOT_CHECKED_IN：未签到且已过窗口（有效 NO_SHOW）、已取消、管理员取消")
    void invalidStatePrecedesNotCheckedIn() throws Exception {
        long stale = todaySlot(zhangsan);
        long cancelled = fixtures.reservation(zhangsan, court2, TODAY, SLOT, "CANCELLED");
        long adminCancelled = fixtures.reservation(zhangsan, court2, TODAY, SLOT, "ADMIN_CANCELLED");
        clock.setLocal(today(9, 50, 0));

        assertThat(assertError(checkOut(zhangsan, stale), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(assertError(checkOut(zhangsan, cancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("CANCELLED");
        assertThat(assertError(checkOut(zhangsan, adminCancelled), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("ADMIN_CANCELLED");
    }

    @Test
    @DisplayName("ACC-M3-05 认证 → 格式 → 角色（VA、SA 为 FORBIDDEN）→ NOT_FOUND → NOT_OWNER（他人已签到的预约）")
    void authenticationFormatRoleNotFoundThenNotOwner() throws Exception {
        long id = checkedInToday(court1);
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        clock.setLocal(today(10, 0, 0));

        assertError(mockMvc.perform(post(RESERVATIONS + "/{id}/check-out", id)).andReturn(),
                ErrorCode.AUTH_REQUIRED);
        assertError(checkOut(userBearer(zhangsan), "abc"), ErrorCode.VALIDATION_ERROR);
        assertError(checkOut(bearer(venueAdmin, Role.VENUE_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(checkOut(bearer(sysAdmin, Role.SYS_ADMIN), id), ErrorCode.FORBIDDEN);
        assertError(checkOut(zhangsan, 999_999), ErrorCode.NOT_FOUND);
        assertError(checkOut(lisi, id), ErrorCode.NOT_OWNER);
        assertThat(checkOutAt(id)).isNull();
    }

    @Test
    @DisplayName("ACC-M3-05 签到后签退的完整流程：签到 IN_USE → 签退 CHECKED_OUT")
    void checkInThenCheckOut() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 25, 0));
        assertThat(json(checkIn(zhangsan, id)).get("displayStatus").asText()).isEqualTo("IN_USE");

        clock.setLocal(today(10, 45, 0));
        JsonNode body = json(checkOut(zhangsan, id));

        assertThat(body.get("displayStatus").asText()).isEqualTo("CHECKED_OUT");
        assertThat(body.get("checkInAt").asText()).isEqualTo("2026-10-12T09:25:00");
        assertThat(body.get("checkOutAt").asText()).isEqualTo("2026-10-12T10:45:00");
    }
}
