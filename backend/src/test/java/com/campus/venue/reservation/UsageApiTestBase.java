package com.campus.venue.reservation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.LocalDateTime;
import java.time.LocalTime;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 签到、签退接口测试的共同部分（BE-4）。典型时段为今天 09:30–11:00：签到窗口 [09:15:00, 09:45:00]，
 * 签退宽限截止 11:30:00（默认参数 15、15、30 分钟，docs/03 第 4.3 节）。
 */
abstract class UsageApiTestBase extends ReservationApiTestBase {

    static final String SLOT = "09:30";

    static LocalDateTime today(int hour, int minute, int second) {
        return LocalDateTime.of(TODAY, LocalTime.of(hour, minute, second));
    }

    /** 今天 09:30 场地 1 上 userId 的 CONFIRMED 预约。 */
    long todaySlot(long userId) {
        return fixtures.reservation(userId, court1, TODAY, SLOT, "CONFIRMED");
    }

    MvcResult checkIn(String authorization, Object id) throws Exception {
        return mockMvc.perform(post(RESERVATIONS + "/" + id + "/check-in")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    MvcResult checkIn(long userId, long id) throws Exception {
        return checkIn(userBearer(userId), id);
    }

    MvcResult checkOut(String authorization, Object id) throws Exception {
        return mockMvc.perform(post(RESERVATIONS + "/" + id + "/check-out")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    MvcResult checkOut(long userId, long id) throws Exception {
        return checkOut(userBearer(userId), id);
    }

    int usageCount(long reservationId) {
        return jdbc.queryForObject("select count(*) from usage_record where reservation_id = ?", Integer.class,
                reservationId);
    }

    String status(long reservationId) {
        return jdbc.queryForObject("select status from reservation where id = ?", String.class, reservationId);
    }
}
