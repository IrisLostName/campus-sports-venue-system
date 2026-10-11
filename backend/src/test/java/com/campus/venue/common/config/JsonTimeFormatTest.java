package com.campus.venue.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.probe.ProbeController;
import com.campus.venue.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** BE-0 裁决 C4：JSON 时间格式严格按 docs/12 第 1 节。 */
@IntegrationTest
@AutoConfigureMockMvc
@Import(ProbeController.class)
class JsonTimeFormatTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void serializesDateTimeAndTimestampInContractFormat() throws Exception {
        MvcResult result = mockMvc.perform(get("/probe/time")).andReturn();

        assertThat(result.getResponse().getContentAsString())
                .isEqualTo("{\"date\":\"2026-10-12\",\"time\":\"08:00\",\"instant\":\"2026-10-12T09:00:00\"}");
    }

    @Test
    void deserializesContractFormatAndEchoesItBack() throws Exception {
        String json = "{\"date\":\"2026-10-13\",\"time\":\"09:30\",\"instant\":\"2026-10-13T10:15:42\"}";

        MvcResult result = mockMvc.perform(post("/probe/time")
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).isEqualTo(json);
    }

    @Test
    void rejectsTimestampWithoutSeconds() throws Exception {
        String json = "{\"date\":\"2026-10-13\",\"time\":\"09:30\",\"instant\":\"2026-10-13T10:15\"}";

        MvcResult result = mockMvc.perform(post("/probe/time")
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
    }
}
