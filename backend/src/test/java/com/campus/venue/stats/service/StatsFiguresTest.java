package com.campus.venue.stats.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** BE-7 T2 口径单测（纯计算，不经接口、不查库）：比率、分母为 0 时 null、大于 1 不截断、不四舍五入、按场馆与按天求和。 */
class StatsFiguresTest {

    private static final LocalDate DAY1 = LocalDate.of(2026, 10, 12);
    private static final LocalDate DAY2 = DAY1.plusDays(1);

    private static StatsFigures figures(PeriodCounts counts) {
        return new StatsFigures(counts, new TodayFacts(List.of(), null, Map.of(), 0));
    }

    @Test
    @DisplayName("利用率 = 有效占用 ÷ 开放时段，未到场率 = NO_SHOW ÷（NO_SHOW + COMPLETED），不四舍五入")
    void ratesAreRawDivisions() {
        PeriodCounts counts = new PeriodCounts();
        counts.open(1, DAY1, 3);
        counts.served(1, DAY1, ReservationStatus.CONFIRMED, 1);
        counts.served(1, DAY1, ReservationStatus.NO_SHOW, 1);
        counts.served(1, DAY1, ReservationStatus.COMPLETED, 2);

        StatsFigures figures = figures(counts);

        assertThat(figures.activeOccupiedSlots()).isEqualTo(4);
        assertThat(figures.openSlots()).isEqualTo(3);
        assertThat(figures.utilizationRate()).isEqualTo(4.0 / 3);
        assertThat(figures.noShowRate()).isEqualTo(1.0 / 3);
    }

    @Test
    @DisplayName("分母为 0 时比率为 null（不是 0、不是 NaN），即使分子大于 0")
    void zeroDenominatorsGiveNull() {
        PeriodCounts counts = new PeriodCounts();
        counts.served(1, DAY1, ReservationStatus.CONFIRMED, 2);
        counts.open(1, DAY1, 0);

        StatsFigures figures = figures(counts);

        assertThat(figures.activeOccupiedSlots()).isEqualTo(2);
        assertThat(figures.utilizationRate()).isNull();
        assertThat(figures.utilizationRate(1)).isNull();
        assertThat(figures.utilizationRateOn(DAY1)).isNull();
        assertThat(figures.noShowRate()).isNull();
        assertThat(StatsFigures.rate(0, 0)).isNull();
        assertThat(StatsFigures.rate(0, 5)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("利用率可大于 1（维护中场地上保留的预约计入占用、不计开放时段），不截断")
    void utilizationAboveOneIsKept() {
        PeriodCounts counts = new PeriodCounts();
        counts.open(1, DAY1, 2);
        counts.served(1, DAY1, ReservationStatus.CONFIRMED, 5);

        assertThat(figures(counts).utilizationRate()).isEqualTo(2.5);
    }

    @Test
    @DisplayName("预约量含已取消并另计两类取消量；有效占用排除两类取消")
    void createdIncludesCancelledButOccupiedExcludesIt() {
        PeriodCounts counts = new PeriodCounts();
        counts.created(1, DAY1, ReservationStatus.CONFIRMED, 2);
        counts.created(1, DAY1, ReservationStatus.CANCELLED, 3);
        counts.created(1, DAY1, ReservationStatus.ADMIN_CANCELLED, 4);
        counts.served(1, DAY1, ReservationStatus.CANCELLED, 3);
        counts.served(1, DAY1, ReservationStatus.ADMIN_CANCELLED, 4);
        counts.served(1, DAY1, ReservationStatus.CONFIRMED, 2);

        StatsFigures figures = figures(counts);

        assertThat(figures.reservationCount()).isEqualTo(9);
        assertThat(figures.userCancelCount()).isEqualTo(3);
        assertThat(figures.adminCancelCount()).isEqualTo(4);
        assertThat(figures.activeOccupiedSlots()).isEqualTo(2);
    }

    @Test
    @DisplayName("越过判定点的候选计入 NO_SHOW / COMPLETED")
    void overdueCandidatesJoinTheNoShowRate() {
        PeriodCounts counts = new PeriodCounts();
        counts.served(1, DAY1, ReservationStatus.COMPLETED, 1);
        counts.overdue(2, 1);

        assertThat(figures(counts).noShowRate()).isEqualTo(0.5);
    }

    @Test
    @DisplayName("按场馆与按天分别求和")
    void sumsByVenueAndByDay() {
        PeriodCounts counts = new PeriodCounts();
        counts.created(1, DAY1, ReservationStatus.CONFIRMED, 1);
        counts.created(2, DAY1, ReservationStatus.CONFIRMED, 2);
        counts.created(2, DAY2, ReservationStatus.COMPLETED, 4);
        counts.open(1, DAY1, 4);
        counts.open(2, DAY1, 4);
        counts.open(2, DAY2, 8);
        counts.served(1, DAY1, ReservationStatus.CONFIRMED, 1);
        counts.served(2, DAY2, ReservationStatus.COMPLETED, 2);

        StatsFigures figures = figures(counts);

        assertThat(figures.reservationCount(1)).isEqualTo(1);
        assertThat(figures.reservationCount(2)).isEqualTo(6);
        assertThat(figures.reservationCount(3)).isZero();
        assertThat(figures.reservationCountOn(DAY1)).isEqualTo(3);
        assertThat(figures.reservationCountOn(DAY2)).isEqualTo(4);
        assertThat(figures.utilizationRate(1)).isEqualTo(0.25);
        assertThat(figures.utilizationRate(2)).isEqualTo(2.0 / 12);
        assertThat(figures.utilizationRateOn(DAY1)).isEqualTo(1.0 / 8);
        assertThat(figures.utilizationRateOn(DAY2)).isEqualTo(0.25);
        assertThat(figures.utilizationRate()).isEqualTo(3.0 / 16);
    }
}
