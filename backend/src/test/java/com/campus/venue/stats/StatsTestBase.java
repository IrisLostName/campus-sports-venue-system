package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.VenueRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * BE-7 统计测试的公共部分：测试数据直接写测试库。fixtures 的预约 created_at 取数据库 now()，
 * 所以凡是 K1 相关的预约都用 reservation(…, createdAt) 显式设置创建时刻。
 */
public abstract class StatsTestBase extends AbstractApiTest {

    /** 2026-10-12，周一；MutableClock 起点 08:30:15。 */
    protected static final LocalDate TODAY = MutableClock.START.toLocalDate();
    protected static final String OVERVIEW = "/api/v1/admin/stats/overview";
    protected static final String SUMMARY = "/api/v1/display/summary";

    protected VenueFixtures fixtures;

    @Autowired
    private VenueRepository venueRepository;

    @BeforeEach
    void createFixtures() {
        fixtures = new VenueFixtures(jdbc);
    }

    /** 指定创建时刻的预约。 */
    protected long reservation(long userId, long resourceId, LocalDate date, String start, String status,
            LocalDateTime createdAt) {
        long id = fixtures.reservation(userId, resourceId, date, start, status);
        jdbc.update("update reservation set created_at = ? where id = ?", Timestamp.valueOf(createdAt), id);
        return id;
    }

    /** 今天 08:00 创建的预约。 */
    protected long reservation(long userId, long resourceId, LocalDate date, String start, String status) {
        return reservation(userId, resourceId, date, start, status, TODAY.atTime(8, 0));
    }

    /** 按 id 升序取场馆实体（统计组件的入参）。 */
    protected List<Venue> venues(Long... ids) {
        return venueRepository.findAllByIdInOrderByIdAsc(Arrays.asList(ids));
    }

    /** GET /admin/stats/overview；params 为成对的参数名与值。 */
    protected MvcResult overview(long userId, Role role, String... params) throws Exception {
        MockHttpServletRequestBuilder request = get(OVERVIEW).header(HttpHeaders.AUTHORIZATION, bearer(userId, role));
        for (int i = 0; i < params.length; i += 2) {
            request.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(request).andReturn();
    }

    /** 成功的总览响应体。 */
    protected JsonNode overviewOk(long userId, Role role, String... params) throws Exception {
        MvcResult result = overview(userId, role, params);
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result);
    }

    /** GET /display/summary，authorization 为 null 时不带 Authorization 头。 */
    protected MvcResult summary(String authorization) throws Exception {
        MockHttpServletRequestBuilder request = get(SUMMARY);
        if (authorization != null) {
            request.header(HttpHeaders.AUTHORIZATION, authorization);
        }
        return mockMvc.perform(request).andReturn();
    }

    /** 不带令牌的成功大屏响应体。 */
    protected JsonNode summaryOk() throws Exception {
        MvcResult result = summary(null);
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        return json(result);
    }

    /** 断言 VALIDATION_ERROR 并取 details.fields。 */
    protected JsonNode fieldsOf(MvcResult result) throws Exception {
        return assertError(result, ErrorCode.VALIDATION_ERROR).get("details").get("fields");
    }
}
