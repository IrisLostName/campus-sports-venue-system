package com.campus.venue.stats.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.stats.StatsTestBase;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-7 T2 口径单测（直接调用统计组件，不经接口，真实数据库）：K1 含已取消、K2 排除两类取消、按创建日期与按服务日期归类
 * （含 23:59:59 与次日 00:00:00 的边界，裁决 P2）、利用率与未到场率、分母为 0 时 null、利用率大于 1。
 */
class StatsCalculatorTest extends StatsTestBase {

    @Autowired
    private StatsCalculator calculator;

    private long venue;
    private long court1;
    private long court2;
    private long owner;

    @BeforeEach
    void seed() {
        venue = fixtures.bookableVenue("网球馆");
        court1 = fixtures.resource(venue, "1号", 1, "OPEN");
        court2 = fixtures.resource(venue, "2号", 2, "OPEN");
        fixtures.weeklyEveryDay(venue, "08:00", "11:00");
        owner = user("owner", Role.USER);
    }

    private StatsFigures compute(LocalDate from, LocalDate to) {
        return calculator.compute(venues(venue), new StatsPeriod(from, to), LocalDateTime.now(clock));
    }

    @Test
    @DisplayName("K1 含两类取消并另计取消量；K2 排除两类取消")
    void reservationCountIncludesBothCancelKinds() {
        LocalDate tomorrow = TODAY.plusDays(1);
        reservation(owner, court1, tomorrow, "08:00", "CONFIRMED");
        reservation(owner, court1, tomorrow, "09:30", "CANCELLED");
        reservation(owner, court2, tomorrow, "08:00", "ADMIN_CANCELLED");
        reservation(owner, court2, tomorrow.plusDays(1), "08:00", "CANCELLED");

        StatsFigures figures = compute(TODAY, TODAY.plusDays(6));

        assertThat(figures.reservationCount()).isEqualTo(4);
        assertThat(figures.userCancelCount()).isEqualTo(2);
        assertThat(figures.adminCancelCount()).isEqualTo(1);
        assertThat(figures.activeOccupiedSlots()).isEqualTo(1);
        assertThat(figures.reservationCountOn(TODAY)).isEqualTo(4);
        assertThat(figures.reservationCount(venue)).isEqualTo(4);
    }

    @Test
    @DisplayName("创建于区间外、使用于区间内：只计 K2；创建于区间内、使用于区间外：只计 K1")
    void createdDateAndServiceDateAreClassifiedSeparately() {
        reservation(owner, court1, TODAY.minusDays(1), "08:00", "COMPLETED", TODAY.minusDays(10).atTime(9, 0));
        reservation(owner, court2, TODAY.plusDays(3), "08:00", "CONFIRMED", TODAY.minusDays(2).atTime(9, 0));

        StatsFigures figures = compute(TODAY.minusDays(6), TODAY);

        assertThat(figures.reservationCount()).isEqualTo(1);
        assertThat(figures.reservationCountOn(TODAY.minusDays(2))).isEqualTo(1);
        assertThat(figures.activeOccupiedSlots()).isEqualTo(1);
        assertThat(figures.utilizationRateOn(TODAY.minusDays(1))).isEqualTo(0.25);
        assertThat(figures.utilizationRateOn(TODAY.minusDays(2))).isEqualTo(0.0);
    }

    @Test
    @DisplayName("P2：created_at 为某日 23:59:59 与次日 00:00:00 的两条预约分属两天")
    void creationAtMidnightBelongsToTheNextDay() {
        LocalDate first = TODAY.minusDays(2);
        reservation(owner, court1, TODAY.plusDays(1), "08:00", "CONFIRMED", first.atTime(LocalTime.of(23, 59, 59)));
        reservation(owner, court2, TODAY.plusDays(1), "08:00", "CONFIRMED", first.plusDays(1).atStartOfDay());

        StatsFigures week = compute(TODAY.minusDays(6), TODAY);

        assertThat(week.reservationCountOn(first)).isEqualTo(1);
        assertThat(week.reservationCountOn(first.plusDays(1))).isEqualTo(1);
        assertThat(compute(first, first).reservationCount()).isEqualTo(1);
        assertThat(compute(first.plusDays(1), first.plusDays(1)).reservationCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("利用率按服务日期：3 个有效占用 ÷ 2 天 × 2 场地 × 2 时段；未到场率按库中 NO_SHOW 与 COMPLETED")
    void utilizationAndNoShowRate() {
        LocalDate day = TODAY.plusDays(1);
        reservation(owner, court1, day, "08:00", "CONFIRMED");
        reservation(owner, court2, day, "09:30", "CONFIRMED");
        reservation(owner, court1, day.plusDays(1), "09:30", "CONFIRMED");
        reservation(owner, court2, day.plusDays(1), "08:00", "CANCELLED");

        StatsFigures future = compute(day, day.plusDays(1));

        assertThat(future.openSlots()).isEqualTo(8);
        assertThat(future.activeOccupiedSlots()).isEqualTo(3);
        assertThat(future.utilizationRate()).isEqualTo(3.0 / 8);
        assertThat(future.utilizationRateOn(day)).isEqualTo(0.5);
        assertThat(future.noShowRate()).isNull();

        LocalDate past = TODAY.minusDays(3);
        reservation(owner, court1, past, "08:00", "NO_SHOW");
        reservation(owner, court2, past, "08:00", "COMPLETED");
        reservation(owner, court1, past, "09:30", "COMPLETED");
        reservation(owner, court2, past, "09:30", "COMPLETED");
        assertThat(compute(past, past).noShowRate()).isEqualTo(0.25);
    }

    @Test
    @DisplayName("没有开放时段时利用率为 null；维护中场地上保留的预约使利用率大于 1")
    void zeroOpenSlotsGiveNullAndRetainedBookingsCanExceedOne() {
        long maintenance = fixtures.resource(venue, "3号", 3, "MAINTENANCE");
        LocalDate day = TODAY.plusDays(1);
        jdbc.update("update resource set operational_status = 'MAINTENANCE' where id = ?", court2);
        reservation(owner, court1, day, "08:00", "CONFIRMED");
        reservation(owner, court1, day, "09:30", "CONFIRMED");
        reservation(owner, court2, day, "08:00", "CONFIRMED");
        reservation(owner, maintenance, day, "08:00", "CONFIRMED");
        reservation(owner, maintenance, day, "09:30", "CONFIRMED");

        StatsFigures figures = compute(day, day);
        assertThat(figures.openSlots()).isEqualTo(2);
        assertThat(figures.utilizationRate()).isEqualTo(2.5);

        jdbc.update("update availability_rule set status = 'INACTIVE'");
        StatsFigures closed = compute(day, day);
        assertThat(closed.openSlots()).isZero();
        assertThat(closed.activeOccupiedSlots()).isEqualTo(5);
        assertThat(closed.utilizationRate()).isNull();
        assertThat(closed.utilizationRate(venue)).isNull();
    }

    @Test
    @DisplayName("范围内没有场馆：计数为 0、比率为 null")
    void emptyScopeGivesZerosAndNulls() {
        reservation(owner, court1, TODAY.plusDays(1), "08:00", "CONFIRMED");

        StatsFigures figures = calculator.compute(List.of(), new StatsPeriod(TODAY, TODAY.plusDays(6)),
                LocalDateTime.now(clock));

        assertThat(figures.reservationCount()).isZero();
        assertThat(figures.activeOccupiedSlots()).isZero();
        assertThat(figures.openSlots()).isZero();
        assertThat(figures.currentInUse()).isZero();
        assertThat(figures.utilizationRate()).isNull();
        assertThat(figures.utilizationRateOn(TODAY)).isNull();
        assertThat(figures.noShowRate()).isNull();
        assertThat(figures.resources()).isEmpty();
    }
}
