package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.support.AbstractApiTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** A4：GET /config/booking-rules 公开、字段逐字一致、默认值来自 docs/03 第 4.3 节。 */
class BookingRulesTest extends AbstractApiTest {

    @Test
    void publicEndpointReturnsTheDocumentedDefaults() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/config/booking-rules")).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode expected = objectMapper.readTree("{\"slotMinutes\":90,\"advanceDays\":7,"
                + "\"cancelDeadlineMinutes\":120,\"checkInOpenBeforeMinutes\":15,\"checkInCloseAfterMinutes\":15,"
                + "\"checkOutGraceMinutes\":30,\"maxActiveReservationsPerUser\":3,\"timezone\":\"Asia/Shanghai\"}");
        assertThat(json(result)).isEqualTo(expected);
    }
}
