package com.campus.venue.reservation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.campus.venue.reservation.service.CheckInCodes;
import com.campus.venue.user.domain.Role;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collections;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 签到、签退接口测试的共同部分（BE-4）。典型时段为今天 09:30–11:00：签到窗口 [09:15:00, 09:45:00]，
 * 签退宽限截止 11:30:00（默认参数 15、15、30 分钟，docs/03 第 4.3 节）。
 */
abstract class UsageApiTestBase extends ReservationApiTestBase {

    static final String SLOT = "09:30";
    static final String ADMIN_CHECK_INS = "/api/v1/admin/check-ins";

    private Long scanner;

    static LocalDateTime today(int hour, int minute, int second) {
        return LocalDateTime.of(TODAY, LocalTime.of(hour, minute, second));
    }

    /** 今天 09:30 场地 1 上 userId 的 CONFIRMED 预约。 */
    long todaySlot(long userId) {
        return fixtures.reservation(userId, court1, TODAY, SLOT, "CONFIRMED");
    }

    /** 用户的随机签到标识（实体不映射该列，直接查库）。 */
    UUID checkInUuid(long userId) {
        return jdbc.queryForObject("select check_in_uuid from app_user where id = ?", UUID.class, userId);
    }

    /** 预约人的签到码，与签发接口的结果相同。 */
    String codeOf(long reservationId) {
        long owner = jdbc.queryForObject("select user_id from reservation where id = ?", Long.class, reservationId);
        return CheckInCodes.format(checkInUuid(owner), reservationId);
    }

    /** POST /admin/check-ins，请求体为 {code}（code 为 null 时写 JSON null）。 */
    MvcResult scan(String authorization, String code) throws Exception {
        return scanBody(authorization, objectMapper.writeValueAsString(Collections.singletonMap("code", code)));
    }

    MvcResult scanBody(String authorization, String json) throws Exception {
        var request = post(ADMIN_CHECK_INS).header(HttpHeaders.AUTHORIZATION, authorization);
        if (json != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json);
        }
        return mockMvc.perform(request).andReturn();
    }

    /** 扫码人：本测试中第一次用到时创建的系统管理员（不在 @BeforeEach 中创建，以免与各测试自建的账号冲突）。 */
    String scannerBearer() {
        if (scanner == null) {
            scanner = user("scanner_sa", Role.SYS_ADMIN);
        }
        return bearer(scanner, Role.SYS_ADMIN);
    }

    /** 系统管理员扫预约人的签到码（契约 v1.1 起签到的唯一入口）。 */
    MvcResult scanIn(long reservationId) throws Exception {
        return scan(scannerBearer(), codeOf(reservationId));
    }

    MvcResult issueCode(String authorization, Object id) throws Exception {
        return mockMvc.perform(get(RESERVATIONS + "/" + id + "/check-in-code")
                .header(HttpHeaders.AUTHORIZATION, authorization)).andReturn();
    }

    MvcResult issueCode(long userId, long id) throws Exception {
        return issueCode(userBearer(userId), id);
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
