package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * T5：GET /reservations/{id}（BE-3 D1）。认证 → id 格式 → NOT_FOUND → USER 非本人 NOT_OWNER /
 * VENUE_ADMIN 越权 FORBIDDEN_SCOPE（details.venueId）/ SYS_ADMIN 通过。
 */
class ReservationDetailApiTest extends ReservationApiTestBase {

    private long sysAdmin;
    private long tennisAdmin;
    private long badmintonAdmin;
    private long reservation;

    @BeforeEach
    void seedReservation() {
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("tennisadmin", Role.VENUE_ADMIN);
        badmintonAdmin = user("badmintonadmin", Role.VENUE_ADMIN);
        long badminton = fixtures.bookableVenue("羽毛球馆");
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        fixtures.grant(badmintonAdmin, badminton, sysAdmin);
        reservation = checkedIn(zhangsan, court1, TODAY, "08:00", LocalDateTime.of(TODAY, LocalTime.of(7, 50)));
        jdbc.update("update reservation set admin_note = '改到网球场1' where id = ?", reservation);
    }

    @Test
    void ownerSeesTheReservation() throws Exception {
        JsonNode body = json(detail(userBearer(zhangsan), reservation));

        assertThat(body.get("id").asLong()).isEqualTo(reservation);
        assertThat(body.get("userId").asLong()).isEqualTo(zhangsan);
        assertThat(body.get("venueName").asText()).isEqualTo("网球馆");
        assertThat(body.get("status").asText()).isEqualTo("CONFIRMED");
        assertThat(body.get("displayStatus").asText()).isEqualTo("IN_USE");
        assertThat(body.get("checkInAt").asText()).isEqualTo("2026-10-12T07:50:00");
        assertThat(body.get("checkOutAt").isNull()).isTrue();
        assertThat(body.get("adminNote").asText()).isEqualTo("改到网球场1");
    }

    @Test
    void otherUserIsNotOwner() throws Exception {
        assertError(detail(userBearer(lisi), reservation), ErrorCode.NOT_OWNER);
    }

    @Test
    void venueAdminInScopeSeesTheReservation() throws Exception {
        JsonNode body = json(detail(bearer(tennisAdmin, Role.VENUE_ADMIN), reservation));

        assertThat(body.get("id").asLong()).isEqualTo(reservation);
    }

    @Test
    void venueAdminOutOfScopeIsForbiddenScope() throws Exception {
        JsonNode body = assertError(detail(bearer(badmintonAdmin, Role.VENUE_ADMIN), reservation),
                ErrorCode.FORBIDDEN_SCOPE);

        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(tennis);
    }

    @Test
    void sysAdminSeesAnyReservation() throws Exception {
        assertThat(json(detail(bearer(sysAdmin, Role.SYS_ADMIN), reservation)).get("id").asLong())
                .isEqualTo(reservation);
    }

    @Test
    void notFoundPrecedesOwnershipAndScope() throws Exception {
        assertError(detail(userBearer(lisi), 999_999), ErrorCode.NOT_FOUND);
        assertError(detail(bearer(badmintonAdmin, Role.VENUE_ADMIN), 999_999), ErrorCode.NOT_FOUND);
    }

    @Test
    void malformedIdIsValidationErrorAndAuthenticationComesFirst() throws Exception {
        JsonNode body = assertError(detail(userBearer(zhangsan), "abc"), ErrorCode.VALIDATION_ERROR);

        assertThat(body.get("details").get("fields").get("id").asText()).isEqualTo("类型不符");
        assertError(mockMvc.perform(get(RESERVATIONS + "/abc")).andReturn(), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void responseStatusIsTheEffectiveStatus() throws Exception {
        long stale = fixtures.reservation(lisi, court2, TODAY, "08:00", "CONFIRMED");

        JsonNode body = json(detail(userBearer(lisi), stale));
        assertThat(body.get("status").asText()).isEqualTo("NO_SHOW");
        assertThat(body.get("displayStatus").asText()).isEqualTo("NO_SHOW");
    }
}
