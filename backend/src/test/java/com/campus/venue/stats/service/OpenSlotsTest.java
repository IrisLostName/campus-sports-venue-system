package com.campus.venue.stats.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.stats.StatsTestBase;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-7 T3 开放时段数（直接调用统计组件）：周窗口切分、同一天多个窗口、整馆与单场地关闭、维护/停用场地、
 * 关闭的场馆、区间内规则不同的两天。TODAY 为周一。
 */
class OpenSlotsTest extends StatsTestBase {

    @Autowired
    private StatsCalculator calculator;

    private StatsFigures compute(long venueId, LocalDate from, LocalDate to) {
        return calculator.compute(venues(venueId), new StatsPeriod(from, to), LocalDateTime.now(clock));
    }

    @Test
    @DisplayName("08:00–20:00 切出 8 个时段；同一天两个窗口合计；维护与停用场地不计")
    void windowsAreSlicedPerOpenResource() {
        long venue = fixtures.bookableVenue("网球馆");
        fixtures.resource(venue, "1号", 1, "OPEN");
        fixtures.resource(venue, "2号", 2, "OPEN");
        fixtures.resource(venue, "3号", 3, "MAINTENANCE");
        fixtures.resource(venue, "4号", 4, "DISABLED");
        fixtures.weekly(venue, 1, "08:00", "20:00");
        fixtures.weekly(venue, 2, "08:00", "11:00");
        fixtures.weekly(venue, 2, "14:00", "17:00");

        StatsFigures figures = compute(venue, TODAY, TODAY.plusDays(2));

        assertThat(figures.openSlots()).isEqualTo(16 + 8);
        assertThat(figures.utilizationRateOn(TODAY)).isEqualTo(0.0);
        assertThat(figures.utilizationRateOn(TODAY.plusDays(2))).isNull();
    }

    @Test
    @DisplayName("整馆关闭扣除全部场地；单场地关闭只扣该场地；关闭范围含两端")
    void closuresRemoveTheCoveredResources() {
        long venue = fixtures.bookableVenue("网球馆");
        long court1 = fixtures.resource(venue, "1号", 1, "OPEN");
        fixtures.resource(venue, "2号", 2, "OPEN");
        fixtures.weeklyEveryDay(venue, "08:00", "11:00");
        fixtures.closure(venue, null, TODAY, TODAY);
        fixtures.closure(venue, court1, TODAY.plusDays(1), TODAY.plusDays(2));

        assertThat(compute(venue, TODAY, TODAY).openSlots()).isZero();
        assertThat(compute(venue, TODAY.plusDays(1), TODAY.plusDays(1)).openSlots()).isEqualTo(2);
        assertThat(compute(venue, TODAY.plusDays(2), TODAY.plusDays(3)).openSlots()).isEqualTo(2 + 4);
    }

    @Test
    @DisplayName("关闭的场馆没有开放时段；按场馆分别计算")
    void closedVenueHasNoOpenSlots() {
        long open = fixtures.bookableVenue("网球馆");
        fixtures.resource(open, "1号", 1, "OPEN");
        fixtures.weeklyEveryDay(open, "08:00", "09:30");
        long closed = fixtures.venue("游泳馆", false, "CLOSED");
        fixtures.resource(closed, "1道", 1, "OPEN");
        fixtures.weeklyEveryDay(closed, "08:00", "20:00");

        StatsFigures figures = calculator.compute(venues(open, closed), new StatsPeriod(TODAY, TODAY.plusDays(1)),
                LocalDateTime.now(clock));

        assertThat(figures.openSlots()).isEqualTo(2);
        assertThat(figures.utilizationRate(open)).isEqualTo(0.0);
        assertThat(figures.utilizationRate(closed)).isNull();
    }

    @Test
    @DisplayName("区间内规则不同的两天各按当天的窗口计算；停用的窗口不计")
    void eachDayUsesItsOwnWeekdayWindows() {
        long venue = fixtures.bookableVenue("网球馆");
        long court = fixtures.resource(venue, "1号", 1, "OPEN");
        fixtures.weekly(venue, 1, "08:00", "11:00");
        fixtures.weekly(venue, 2, "08:00", "20:00");
        fixtures.deactivateRule(fixtures.weekly(venue, 2, "20:00", "21:30"));
        long owner = user("owner", Role.USER);
        reservation(owner, court, TODAY.plusDays(1), "08:00", "CONFIRMED");

        StatsFigures figures = compute(venue, TODAY, TODAY.plusDays(1));

        assertThat(figures.openSlots()).isEqualTo(2 + 8);
        assertThat(figures.utilizationRateOn(TODAY)).isEqualTo(0.0);
        assertThat(figures.utilizationRateOn(TODAY.plusDays(1))).isEqualTo(1.0 / 8);
    }
}
