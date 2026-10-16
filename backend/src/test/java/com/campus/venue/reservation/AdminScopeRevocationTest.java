package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
 * BE-5 K3（BE-3 复审 R1）、ACC-M3-07：撤销授权即时生效的接口层用例。授权不写入令牌、每次请求查库（docs/08 第 3 节），
 * 所以同一个令牌在撤销前 200、撤销后 403 FORBIDDEN_SCOPE。撤销用 JDBC 写测试库 venue_booking_test（BE-5 裁决 P7）。
 */
@DisplayName("ACC-M3-07 撤销授权即时生效")
class AdminScopeRevocationTest extends AdminReservationApiTestBase {

    private MvcResult listWith(String authorization, String venueId) throws Exception {
        return mockMvc.perform(get(LIST).param("venueId", venueId)
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    private MvcResult cancelWith(String authorization, long id) throws Exception {
        return mockMvc.perform(post(CANCEL, id).header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"临时调整\"}")).andReturn();
    }

    private void assertForbiddenScope(MvcResult result) throws Exception {
        JsonNode body = assertError(result, ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").size()).isEqualTo(1);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(tennis);
    }

    @Test
    @DisplayName("ACC-M3-07 同一令牌：撤销前列表与取消均 200，撤销后均 403 FORBIDDEN_SCOPE {venueId}，不改预约、不写日志")
    void revocationTakesEffectOnTheNextRequest() throws Exception {
        String authorization = bearer(tennisAdmin, Role.VENUE_ADMIN);
        long first = reservation(zhangsan, court1, TOMORROW, "09:30");
        long second = reservation(lisi, court2, TOMORROW, "09:30");

        assertThat(itemIds(listWith(authorization, String.valueOf(tennis)))).containsExactlyInAnyOrder(first, second);
        assertThat(ok(cancelWith(authorization, first)).get("status").asText()).isEqualTo("ADMIN_CANCELLED");
        assertThat(logCount()).isEqualTo(1);

        int revoked = jdbc.update("update admin_venue_scope set status = 'REVOKED' where admin_id = ? and venue_id = ?",
                tennisAdmin, tennis);
        assertThat(revoked).isEqualTo(1);

        assertForbiddenScope(listWith(authorization, String.valueOf(tennis)));
        assertForbiddenScope(cancelWith(authorization, second));
        assertThat(reservationRow(second)).containsEntry("status", "CONFIRMED").containsEntry("admin_note", null);
        assertThat(logCount()).isEqualTo(1);
        JsonNode unscoped = ok(mockMvc.perform(get(LIST).header(HttpHeaders.AUTHORIZATION, authorization))
                .andReturn());
        assertThat(unscoped.get("items")).isEmpty();
        assertThat(unscoped.get("total").asLong()).isZero();
    }
}
