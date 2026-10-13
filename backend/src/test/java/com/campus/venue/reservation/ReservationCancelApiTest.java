package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * T4：POST /reservations/{id}/cancel（docs/10 第 3 节，BE-3 X1、X2）。认证 → 格式 → 角色 USER → NOT_FOUND → NOT_OWNER
 * → INVALID_STATE（有效状态）→ ALREADY_CHECKED_IN → CANCEL_DEADLINE_PASSED（距开始正好 cancelDeadlineMinutes 允许）。
 */
class ReservationCancelApiTest extends ReservationApiTestBase {

    private long tomorrowFor(long userId) {
        return fixtures.reservation(userId, court1, TOMORROW, "09:30", "CONFIRMED");
    }

    private String status(long id) {
        return jdbc.queryForObject("select status from reservation where id = ?", String.class, id);
    }

    @Test
    void ownerCancelsAndTheRowRecordsWhoWhenAndWhy() throws Exception {
        long id = tomorrowFor(zhangsan);

        MvcResult result = cancel(zhangsan, id, "{\"reason\":\"临时有事\"}");

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = json(result);
        assertThat(body.get("status").asText()).isEqualTo("CANCELLED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("CANCELLED");
        assertThat(body.get("cancelledAt").asText()).isEqualTo("2026-10-12T08:30:15");
        assertThat(body.get("cancelledBy").asLong()).isEqualTo(zhangsan);
        assertThat(body.get("cancelReason").asText()).isEqualTo("临时有事");
        Map<String, Object> row = jdbc.queryForMap("select status, cancelled_by, cancel_reason,"
                + " cancelled_at::text as cancelled_at, updated_at::text as updated_at from reservation where id = ?", id);
        assertThat(row).containsEntry("status", "CANCELLED").containsEntry("cancelled_by", zhangsan)
                .containsEntry("cancel_reason", "临时有事").containsEntry("cancelled_at", "2026-10-12 08:30:15")
                .containsEntry("updated_at", "2026-10-12 08:30:15");
    }

    @Test
    void bodyIsOptionalAndBlankReasonIsStoredAsNull() throws Exception {
        long first = tomorrowFor(zhangsan);
        long second = fixtures.reservation(zhangsan, court2, TOMORROW, "09:30", "CONFIRMED");

        assertThat(json(cancel(zhangsan, first, null)).get("cancelReason").isNull()).isTrue();
        assertThat(json(cancel(zhangsan, second, "{\"reason\":\"  \"}")).get("cancelReason").isNull()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from reservation where cancel_reason is null"
                + " and status = 'CANCELLED'", Integer.class)).isEqualTo(2);
    }

    @Test
    void cancelledSlotCanBeBookedByAnotherUser() throws Exception {
        long id = tomorrowFor(zhangsan);
        assertError(create(lisi, court1, TOMORROW, "09:30"), ErrorCode.SLOT_TAKEN);

        cancel(zhangsan, id, null);

        assertThat(create(lisi, court1, TOMORROW, "09:30").getResponse().getStatus()).isEqualTo(201);
        assertThat(activeCount(court1, TOMORROW, "09:30")).isEqualTo(1);
    }

    @Test
    void reasonLongerThan200CharactersIsRejectedBeforeRole() throws Exception {
        long id = tomorrowFor(zhangsan);
        String tooLong = "{\"reason\":\"" + "因".repeat(201) + "\"}";
        long venueAdmin = user("tennisadmin", Role.VENUE_ADMIN);

        JsonNode body = assertError(cancel(zhangsan, id, tooLong), ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("reason").asText()).isEqualTo("不能超过 200 个字符");
        MvcResult asAdmin = mockMvc.perform(post(RESERVATIONS + "/{id}/cancel", id)
                .header(HttpHeaders.AUTHORIZATION, bearer(venueAdmin, Role.VENUE_ADMIN))
                .contentType(MediaType.APPLICATION_JSON).content(tooLong)).andReturn();
        assertError(asAdmin, ErrorCode.VALIDATION_ERROR);
        assertThat(cancel(zhangsan, id, "{\"reason\":\"" + "因".repeat(200) + "\"}").getResponse().getStatus())
                .isEqualTo(200);
    }

    @Test
    void authenticationThenRoleThenNotFound() throws Exception {
        long id = tomorrowFor(zhangsan);
        long sysAdmin = user("sysadmin", Role.SYS_ADMIN);

        assertError(mockMvc.perform(post(RESERVATIONS + "/{id}/cancel", id)).andReturn(), ErrorCode.AUTH_REQUIRED);
        assertError(mockMvc.perform(post(RESERVATIONS + "/{id}/cancel", 999_999)
                .header(HttpHeaders.AUTHORIZATION, bearer(sysAdmin, Role.SYS_ADMIN))).andReturn(), ErrorCode.FORBIDDEN);
        assertError(cancel(zhangsan, 999_999, null), ErrorCode.NOT_FOUND);
        assertError(mockMvc.perform(post(RESERVATIONS + "/abc/cancel")
                .header(HttpHeaders.AUTHORIZATION, userBearer(zhangsan))).andReturn(), ErrorCode.VALIDATION_ERROR);
        assertThat(status(id)).isEqualTo("CONFIRMED");
    }

    @Test
    void notOwnerPrecedesState() throws Exception {
        long cancelled = fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CANCELLED");

        assertError(cancel(lisi, tomorrowFor(zhangsan), null), ErrorCode.NOT_OWNER);
        assertError(cancel(lisi, cancelled, null), ErrorCode.NOT_OWNER);
    }

    @Test
    void storedTerminalStatusIsInvalidState() throws Exception {
        long cancelled = fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CANCELLED");
        long completed = fixtures.reservation(zhangsan, court1, TODAY.minusDays(1), "09:30", "COMPLETED");

        assertThat(assertError(cancel(zhangsan, cancelled, null), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("CANCELLED");
        assertThat(assertError(cancel(zhangsan, completed, null), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    void confirmedPastTheNoShowPointIsInvalidStateWithEffectiveStatus() throws Exception {
        long stale = fixtures.reservation(zhangsan, court1, TODAY, "08:00", "CONFIRMED");

        JsonNode body = assertError(cancel(zhangsan, stale, null), ErrorCode.INVALID_STATE);

        assertThat(body.get("details").get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(status(stale)).isEqualTo("CONFIRMED");
    }

    @Test
    void checkedInIsAlreadyCheckedInBeforeTheDeadlineCheck() throws Exception {
        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 20)));
        long id = checkedIn(zhangsan, court1, TODAY, "09:30", LocalDateTime.of(TODAY, LocalTime.of(9, 16)));

        assertError(cancel(zhangsan, id, null), ErrorCode.ALREADY_CHECKED_IN);
    }

    @Test
    void checkedInAndEndedIsInvalidStateBeforeAlreadyCheckedIn() throws Exception {
        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(11, 0)));
        long id = checkedIn(zhangsan, court1, TODAY, "09:30", LocalDateTime.of(TODAY, LocalTime.of(9, 16)));

        assertThat(assertError(cancel(zhangsan, id, null), ErrorCode.INVALID_STATE)
                .get("details").get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    void deadlineBoundaryExactlyCancelDeadlineMinutesIsAllowed() throws Exception {
        long exact = fixtures.reservation(zhangsan, court1, TODAY, "11:00", "CONFIRMED");
        long late = fixtures.reservation(zhangsan, court2, TODAY, "11:00", "CONFIRMED");

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 0, 1)));
        JsonNode body = assertError(cancel(zhangsan, late, null), ErrorCode.CANCEL_DEADLINE_PASSED);
        assertThat(body.get("details").get("cancelDeadlineMinutes").asInt()).isEqualTo(120);
        assertThat(status(late)).isEqualTo("CONFIRMED");

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 0)));
        assertThat(cancel(zhangsan, exact, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(status(exact)).isEqualTo("CANCELLED");
    }
}
