package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.service.ReservationSweepService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.aggregator.ArgumentsAccessor;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/**
 * TEST-1 K7 边界时刻（FE-3 审计第 11 节第 3 条、台账 ACC-M3-12 第 5 节第 2 条）：今天 09:30–11:00 的时段，
 * 取消截止 07:30、签到窗口 [09:15, 09:45]、结束 11:00、签退宽限截止 11:30（不含），各取“前一秒 / 正好 / 后一秒”。
 * 每行：按签到记录状态（NONE 无、IN 09:20 签到、OUT 09:20 签到 10:30 签退）造预约，时钟只来自可调 Clock；
 * 断言 GET 详情的 status（有效状态）与 displayStatus、对应接口的结果（成功时返回的 displayStatus），
 * 最后运行一次清扫，断言库中状态与有效状态一致。
 */
@DisplayName("ACC-M3-05 边界时刻")
class BoundaryMomentApiTest extends UsageApiTestBase {

    @Autowired
    private ReservationSweepService sweepService;

    private long reservationWith(String usage) {
        long id = todaySlot(zhangsan);
        if (!"NONE".equals(usage)) {
            fixtures.usage(id, today(9, 20, 0), "OUT".equals(usage) ? today(10, 30, 0) : null);
        }
        return id;
    }

    private MvcResult act(String action, long id) throws Exception {
        return switch (action) {
            case "cancel" -> cancel(zhangsan, id, null);
            case "check-in" -> checkIn(zhangsan, id);
            case "check-out" -> checkOut(zhangsan, id);
            default -> throw new IllegalArgumentException(action);
        };
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            取消截止前 1 秒          | 07:29:59 | NONE | CONFIRMED | UPCOMING     | cancel    | 200                    | CANCELLED   | CANCELLED
            取消截止正好（允许）      | 07:30:00 | NONE | CONFIRMED | UPCOMING     | cancel    | 200                    | CANCELLED   | CANCELLED
            取消截止后 1 秒          | 07:30:01 | NONE | CONFIRMED | UPCOMING     | cancel    | CANCEL_DEADLINE_PASSED | -           | CONFIRMED
            签到窗口开启前 1 秒      | 09:14:59 | NONE | CONFIRMED | UPCOMING     | check-in  | CHECKIN_WINDOW_CLOSED  | -           | CONFIRMED
            签到窗口开启正好         | 09:15:00 | NONE | CONFIRMED | CHECKIN_OPEN | check-in  | 200                    | IN_USE      | CONFIRMED
            签到窗口开启后 1 秒      | 09:15:01 | NONE | CONFIRMED | CHECKIN_OPEN | check-in  | 200                    | IN_USE      | CONFIRMED
            签到窗口关闭前 1 秒      | 09:44:59 | NONE | CONFIRMED | CHECKIN_OPEN | check-in  | 200                    | IN_USE      | CONFIRMED
            签到窗口关闭正好         | 09:45:00 | NONE | CONFIRMED | CHECKIN_OPEN | check-in  | 200                    | IN_USE      | CONFIRMED
            签到窗口关闭后 1 秒      | 09:45:01 | NONE | NO_SHOW   | NO_SHOW      | check-in  | INVALID_STATE          | -           | NO_SHOW
            结束前 1 秒，未签到      | 10:59:59 | NONE | NO_SHOW   | NO_SHOW      | check-out | INVALID_STATE          | -           | NO_SHOW
            结束前 1 秒，已签到      | 10:59:59 | IN   | CONFIRMED | IN_USE       | check-out | 200                    | CHECKED_OUT | CONFIRMED
            结束正好，已签到         | 11:00:00 | IN   | COMPLETED | COMPLETED    | check-out | 200                    | COMPLETED   | COMPLETED
            结束后 1 秒，已签到      | 11:00:01 | IN   | COMPLETED | COMPLETED    | check-out | 200                    | COMPLETED   | COMPLETED
            结束前 1 秒，已签退      | 10:59:59 | OUT  | CONFIRMED | CHECKED_OUT  | check-out | ALREADY_CHECKED_OUT    | -           | CONFIRMED
            结束正好，已签退         | 11:00:00 | OUT  | COMPLETED | COMPLETED    | check-out | ALREADY_CHECKED_OUT    | -           | COMPLETED
            结束后 1 秒，已签退      | 11:00:01 | OUT  | COMPLETED | COMPLETED    | check-out | ALREADY_CHECKED_OUT    | -           | COMPLETED
            签退宽限截止前 1 秒      | 11:29:59 | IN   | COMPLETED | COMPLETED    | check-out | 200                    | COMPLETED   | COMPLETED
            签退宽限截止正好（不含）  | 11:30:00 | IN   | COMPLETED | COMPLETED    | check-out | INVALID_STATE          | -           | COMPLETED
            签退宽限截止后 1 秒      | 11:30:01 | IN   | COMPLETED | COMPLETED    | check-out | INVALID_STATE          | -           | COMPLETED
            """)
    @DisplayName("边界时刻：有效状态、displayStatus、接口结果与清扫落库一致")
    void boundaryMoment(ArgumentsAccessor row) throws Exception {
        long id = reservationWith(row.getString(2));
        clock.setLocal(TODAY.atTime(LocalTime.parse(row.getString(1))));

        JsonNode view = json(detail(userBearer(zhangsan), id));
        assertThat(view.get("status").asText()).as("有效状态").isEqualTo(row.getString(3));
        assertThat(view.get("displayStatus").asText()).as("displayStatus").isEqualTo(row.getString(4));

        MvcResult result = act(row.getString(5), id);
        String outcome = row.getString(6);
        if ("200".equals(outcome)) {
            assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
            assertThat(json(result).get("displayStatus").asText()).isEqualTo(row.getString(7));
        } else {
            JsonNode error = assertError(result, ErrorCode.valueOf(outcome));
            if ("INVALID_STATE".equals(outcome)) {
                assertThat(error.get("details").get("status").asText()).isEqualTo(row.getString(3));
            }
        }

        sweepService.sweep();
        assertThat(status(id)).as("清扫后库中状态").isEqualTo(row.getString(8));
    }
}
