package com.campus.venue.reservation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 预约接口测试的共同数据：时钟 2026-10-12（周一）08:30:15；网球馆可预约，每天 08:00–20:00；
 * 网球场1、网球场2 为 OPEN；用户 zhangsan、lisi（USER）。
 */
abstract class ReservationApiTestBase extends AbstractApiTest {

    static final String RESERVATIONS = "/api/v1/reservations";
    static final LocalDate TODAY = MutableClock.START.toLocalDate();
    static final LocalDate TOMORROW = TODAY.plusDays(1);

    VenueFixtures fixtures;
    long zhangsan;
    long lisi;
    long tennis;
    long court1;
    long court2;

    @BeforeEach
    void seedTennis() {
        fixtures = new VenueFixtures(jdbc);
        zhangsan = user("zhangsan", Role.USER);
        lisi = user("lisi", Role.USER);
        tennis = fixtures.bookableVenue("网球馆");
        court1 = fixtures.resource(tennis, "网球场1", 1, "OPEN");
        court2 = fixtures.resource(tennis, "网球场2", 2, "OPEN");
        fixtures.weeklyEveryDay(tennis, "08:00", "20:00");
    }

    String userBearer(long userId) {
        return bearer(userId, Role.USER);
    }

    static String body(long resourceId, LocalDate date, String start) {
        return "{\"resourceId\":" + resourceId + ",\"serviceDate\":\"" + date + "\",\"startTime\":\"" + start + "\"}";
    }

    MvcResult create(String authorization, String json) throws Exception {
        return mockMvc.perform(post(RESERVATIONS).header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();
    }

    MvcResult create(long userId, long resourceId, LocalDate date, String start) throws Exception {
        return create(userBearer(userId), body(resourceId, date, start));
    }

    MvcResult cancel(long userId, long reservationId, String json) throws Exception {
        var request = post(RESERVATIONS + "/{id}/cancel", reservationId)
                .header(HttpHeaders.AUTHORIZATION, userBearer(userId));
        if (json != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

    MvcResult detail(String authorization, Object id) throws Exception {
        return mockMvc.perform(get(RESERVATIONS + "/" + id).header(HttpHeaders.AUTHORIZATION, authorization))
                .andReturn();
    }

    /** 已签到的预约：先插入预约，再写使用记录。 */
    long checkedIn(long userId, long resourceId, LocalDate date, String start, LocalDateTime checkIn) {
        long id = fixtures.reservation(userId, resourceId, date, start, "CONFIRMED");
        fixtures.usage(id, checkIn, null);
        return id;
    }

    int activeCount(long resourceId, LocalDate date, String start) {
        return jdbc.queryForObject("select count(*) from reservation where resource_id = ? and service_date = ?"
                + " and start_time = cast(? as time) and status not in ('CANCELLED', 'ADMIN_CANCELLED')",
                Integer.class, resourceId, date, start);
    }
}
