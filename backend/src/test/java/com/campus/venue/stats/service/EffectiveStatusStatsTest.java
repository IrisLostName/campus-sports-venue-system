package com.campus.venue.stats.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.stats.StatsTestBase;
import com.campus.venue.stats.domain.StatsPeriod;
import com.campus.venue.user.domain.Role;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-7 T4 有效状态（K7，直接调用统计组件）：库中 CONFIRMED 而已越过判定点的预约按 NO_SHOW / COMPLETED 计入未到场率；
 * currentInUse 的开始与结束边界、提前签到（尚未开始）与签退后不计，且与统计区间无关。
 */
class EffectiveStatusStatsTest extends StatsTestBase {

    @Autowired
    private StatsCalculator calculator;

    private long venue;
    private long court1;
    private long court2;
    private long court3;
    private long owner;

    @BeforeEach
    void seed() {
        venue = fixtures.bookableVenue("网球馆");
        court1 = fixtures.resource(venue, "1号", 1, "OPEN");
        court2 = fixtures.resource(venue, "2号", 2, "OPEN");
        court3 = fixtures.resource(venue, "3号", 3, "OPEN");
        fixtures.weeklyEveryDay(venue, "08:00", "20:00");
        owner = user("owner", Role.USER);
    }

    private StatsFigures at(LocalDateTime now, LocalDate from, LocalDate to) {
        clock.setLocal(now);
        return calculator.compute(venues(venue), new StatsPeriod(from, to), LocalDateTime.now(clock));
    }

    private StatsFigures at(LocalDateTime now) {
        return at(now, now.toLocalDate().minusDays(6), now.toLocalDate());
    }

    @Test
    @DisplayName("库中 CONFIRMED、未签到：正好在 开始 + 15 分钟 仍不计，越过后计入 NO_SHOW；前一天漏清扫的同样计入")
    void overdueConfirmedCountsAsNoShow() {
        reservation(owner, court1, TODAY, "08:00", "CONFIRMED");
        reservation(owner, court2, TODAY.minusDays(1), "08:00", "COMPLETED");
        reservation(owner, court3, TODAY.minusDays(1), "09:30", "CONFIRMED");

        assertThat(at(TODAY.atTime(8, 15)).noShowRate()).isEqualTo(0.5);
        assertThat(at(TODAY.atTime(8, 15, 1)).noShowRate()).isEqualTo(2.0 / 3);
    }

    @Test
    @DisplayName("库中 CONFIRMED、已签到未签退：结束前仍在使用，正好到结束时刻起计入 COMPLETED")
    void checkedInPastTheEndCountsAsCompleted() {
        long held = reservation(owner, court1, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(held, TODAY.atTime(7, 55), null);
        reservation(owner, court2, TODAY, "08:00", "NO_SHOW");

        StatsFigures before = at(TODAY.atTime(9, 29, 59));
        assertThat(before.noShowRate()).isEqualTo(1.0);
        assertThat(before.currentInUse()).isEqualTo(1);

        StatsFigures atEnd = at(TODAY.atTime(9, 30));
        assertThat(atEnd.noShowRate()).isEqualTo(0.5);
        assertThat(atEnd.currentInUse()).isZero();
    }

    @Test
    @DisplayName("currentInUse：正好等于开始计入、正好等于结束不计；提前签到在开始前不计；签退后不计；与区间无关")
    void currentInUseBoundaries() {
        long held = reservation(owner, court1, TODAY, "09:30", "CONFIRMED");
        fixtures.usage(held, TODAY.atTime(9, 20), null);
        long left = reservation(owner, court2, TODAY, "09:30", "CONFIRMED");
        fixtures.usage(left, TODAY.atTime(9, 25), null);
        reservation(owner, court3, TODAY, "09:30", "CONFIRMED");

        assertThat(at(TODAY.atTime(9, 29, 59)).currentInUse()).isZero();
        assertThat(at(TODAY.atTime(9, 30)).currentInUse()).isEqualTo(2);
        jdbc.update("update usage_record set check_out_at = ? where reservation_id = ?",
                Timestamp.valueOf(TODAY.atTime(10, 0)), left);
        assertThat(at(TODAY.atTime(10, 0)).currentInUse()).isEqualTo(1);
        assertThat(at(TODAY.atTime(10, 59, 59)).currentInUse()).isEqualTo(1);
        assertThat(at(TODAY.atTime(11, 0)).currentInUse()).isZero();
        assertThat(at(TODAY.atTime(10, 30), TODAY.minusDays(30), TODAY.minusDays(20)).currentInUse()).isEqualTo(1);
    }
}
