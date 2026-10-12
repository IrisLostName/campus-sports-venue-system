package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-03（第 2–6 步）：创建预约的九步校验顺序与错误码与 docs/10 第 1 节一致。
 * 每步至少一个失败用例，并以“同时违反两步时返回靠前一步的错误码”证明顺序。第 7–9 步见 ReservationCreateLimitTest。
 */
@DisplayName("ACC-M3-03 创建预约九步校验：第 2–6 步")
class ReservationCreateStepsTest extends ReservationApiTestBase {

    private void assertCreateFails(MvcResult result, ErrorCode code) throws Exception {
        assertError(result, code);
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isZero();
    }

    @Test
    @DisplayName("ACC-M3-03 第 2 步：场地不存在、场馆关闭、未开放用户预约 → VENUE_NOT_BOOKABLE")
    void step2VenueNotBookable() throws Exception {
        assertCreateFails(create(zhangsan, 999_999, TOMORROW, "09:30"), ErrorCode.VENUE_NOT_BOOKABLE);

        long closed = fixtures.venue("羽毛球馆", true, "CLOSED");
        long closedCourt = fixtures.resource(closed, "羽毛球场1", 1, "OPEN");
        fixtures.weeklyEveryDay(closed, "08:00", "20:00");
        assertCreateFails(create(zhangsan, closedCourt, TOMORROW, "09:30"), ErrorCode.VENUE_NOT_BOOKABLE);

        long disabled = fixtures.venue("游泳馆", false, "OPEN");
        long lane = fixtures.resource(disabled, "泳道1", 1, "OPEN");
        fixtures.weeklyEveryDay(disabled, "08:00", "20:00");
        assertCreateFails(create(zhangsan, lane, TOMORROW, "09:30"), ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    @DisplayName("ACC-M3-03 顺序：第 2 步先于第 3 步")
    void step2BeforeStep3() throws Exception {
        long closed = fixtures.venue("羽毛球馆", true, "CLOSED");
        long maintenance = fixtures.resource(closed, "羽毛球场1", 1, "MAINTENANCE");

        assertCreateFails(create(zhangsan, maintenance, TOMORROW, "09:30"), ErrorCode.VENUE_NOT_BOOKABLE);
    }

    @Test
    @DisplayName("ACC-M3-03 第 3 步：场地 MAINTENANCE、DISABLED → RESOURCE_UNAVAILABLE；先于第 4 步")
    void step3ResourceUnavailable() throws Exception {
        long maintenance = fixtures.resource(tennis, "网球场3", 3, "MAINTENANCE");
        long disabled = fixtures.resource(tennis, "网球场4", 4, "DISABLED");

        assertCreateFails(create(zhangsan, maintenance, TOMORROW, "09:30"), ErrorCode.RESOURCE_UNAVAILABLE);
        assertCreateFails(create(zhangsan, disabled, TOMORROW, "09:30"), ErrorCode.RESOURCE_UNAVAILABLE);
        assertCreateFails(create(zhangsan, maintenance, TODAY.minusDays(1), "09:30"),
                ErrorCode.RESOURCE_UNAVAILABLE);
    }

    @Test
    @DisplayName("ACC-M3-03 第 4 步：日期早于今天或不早于 今天+advanceDays → DATE_OUT_OF_RANGE（details.advanceDays）")
    void step4DateOutOfRange() throws Exception {
        assertThat(assertError(create(zhangsan, court1, TODAY.minusDays(1), "09:30"), ErrorCode.DATE_OUT_OF_RANGE)
                .get("details").get("advanceDays").asInt()).isEqualTo(7);
        assertCreateFails(create(zhangsan, court1, TODAY.plusDays(7), "09:30"), ErrorCode.DATE_OUT_OF_RANGE);

        assertThat(create(zhangsan, court1, TODAY.plusDays(6), "09:30").getResponse().getStatus()).isEqualTo(201);
        assertThat(create(zhangsan, court2, TODAY, "09:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 顺序：同时违反第 4、5、6 步时返回第 4 步 DATE_OUT_OF_RANGE")
    void step4BeforeSteps5And6() throws Exception {
        // 昨天 09:30 既超出日期范围又已过去；昨天 08:15 还不是派生时段
        assertCreateFails(create(zhangsan, court1, TODAY.minusDays(1), "09:30"), ErrorCode.DATE_OUT_OF_RANGE);
        assertCreateFails(create(zhangsan, court1, TODAY.minusDays(1), "08:15"), ErrorCode.DATE_OUT_OF_RANGE);
        assertCreateFails(create(zhangsan, court1, TODAY.plusDays(7), "08:15"), ErrorCode.DATE_OUT_OF_RANGE);
    }

    @Test
    @DisplayName("ACC-M3-03 第 5 步：非派生时段 → SLOT_NOT_AVAILABLE")
    void step5NotADerivedSlot() throws Exception {
        assertCreateFails(create(zhangsan, court1, TOMORROW, "08:15"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertCreateFails(create(zhangsan, court1, TOMORROW, "20:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertCreateFails(create(zhangsan, court1, TOMORROW, "07:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertThat(create(zhangsan, court1, TOMORROW, "18:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 第 5 步：当天 INACTIVE 的每周窗口不派生时段 → SLOT_NOT_AVAILABLE")
    void step5InactiveWeeklyWindow() throws Exception {
        long badminton = fixtures.bookableVenue("羽毛球馆");
        long court = fixtures.resource(badminton, "羽毛球场1", 1, "OPEN");
        fixtures.deactivateRule(fixtures.weekly(badminton, TOMORROW.getDayOfWeek().getValue(), "08:00", "20:00"));

        assertCreateFails(create(zhangsan, court, TOMORROW, "09:30"), ErrorCode.SLOT_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("ACC-M3-03 第 5 步：整馆关闭 → SLOT_NOT_AVAILABLE")
    void step5WholeVenueClosure() throws Exception {
        fixtures.closure(tennis, null, TOMORROW, TOMORROW);

        assertCreateFails(create(zhangsan, court1, TOMORROW, "09:30"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertCreateFails(create(zhangsan, court2, TOMORROW, "09:30"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertThat(create(zhangsan, court1, TOMORROW.plusDays(1), "09:30").getResponse().getStatus())
                .isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 第 5 步：本场地关闭（日期范围含两端）→ SLOT_NOT_AVAILABLE，其他场地不受影响")
    void step5ResourceClosure() throws Exception {
        fixtures.closure(tennis, court1, TOMORROW, TOMORROW.plusDays(1));

        assertCreateFails(create(zhangsan, court1, TOMORROW, "09:30"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertCreateFails(create(zhangsan, court1, TOMORROW.plusDays(1), "09:30"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertThat(create(zhangsan, court2, TOMORROW, "09:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 第 5 步：INACTIVE 的关闭不生效")
    void step5InactiveClosureDoesNotApply() throws Exception {
        fixtures.deactivateRule(fixtures.closure(tennis, court1, TOMORROW, TOMORROW));

        assertThat(create(zhangsan, court1, TOMORROW, "09:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 顺序：同时违反第 5、6 步时返回第 5 步 SLOT_NOT_AVAILABLE")
    void step5BeforeStep6() throws Exception {
        fixtures.closure(tennis, court1, TODAY, TODAY);

        assertCreateFails(create(zhangsan, court1, TODAY, "08:00"), ErrorCode.SLOT_NOT_AVAILABLE);
        assertCreateFails(create(zhangsan, court2, TODAY, "07:45"), ErrorCode.SLOT_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("ACC-M3-03 第 6 步：今天已开始的时段 → SLOT_IN_PAST")
    void step6SlotInPast() throws Exception {
        assertCreateFails(create(zhangsan, court1, TODAY, "08:00"), ErrorCode.SLOT_IN_PAST);
    }

    @Test
    @DisplayName("ACC-M3-03 第 6 步边界：开始时刻正好等于现在 → SLOT_IN_PAST；早 1 秒可预约")
    void step6Boundary() throws Exception {
        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 30)));
        assertCreateFails(create(zhangsan, court1, TODAY, "09:30"), ErrorCode.SLOT_IN_PAST);

        clock.setLocal(LocalDateTime.of(TODAY, LocalTime.of(9, 29, 59)));
        assertThat(create(zhangsan, court1, TODAY, "09:30").getResponse().getStatus()).isEqualTo(201);
    }

    @Test
    @DisplayName("ACC-M3-03 顺序：同时违反第 6、7、8 步时返回第 6 步 SLOT_IN_PAST")
    void step6BeforeSteps7And8() throws Exception {
        fixtures.reservation(zhangsan, court1, TOMORROW, "08:00", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "09:30", "CONFIRMED");
        fixtures.reservation(zhangsan, court1, TOMORROW, "11:00", "CONFIRMED");
        fixtures.reservation(lisi, court2, TODAY, "08:00", "CONFIRMED");

        assertError(create(zhangsan, court2, TODAY, "08:00"), ErrorCode.SLOT_IN_PAST);
    }
}
