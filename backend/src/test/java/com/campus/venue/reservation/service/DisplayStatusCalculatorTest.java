package com.campus.venue.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.reservation.domain.DisplayStatus;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/**
 * P1、P2：展示状态的边界时刻。签到窗口为闭区间：开启时刻正好、关闭时刻正好均为 CHECKIN_OPEN，关闭后 1 秒为 NO_SHOW；
 * 已签到于结束时刻正好为 COMPLETED。参数取 BookingProperties（含一组非对称取值，证明没有写死 15）。
 */
class DisplayStatusCalculatorTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 13);
    private static final LocalDateTime START = LocalDateTime.of(DAY, LocalTime.of(9, 30));
    private static final LocalDateTime END = START.plusMinutes(90);

    private static BookingProperties properties(int openBefore, int closeAfter) {
        return new BookingProperties(7, 120, openBefore, closeAfter, 30, 3);
    }

    private final BookingProperties defaults = properties(15, 15);
    private final DisplayStatusCalculator calculator = new DisplayStatusCalculator(defaults);

    private static Reservation reservation(ReservationStatus status) {
        Reservation reservation = new Reservation();
        reservation.setServiceDate(DAY);
        reservation.setStartTime(START.toLocalTime());
        reservation.setEndTime(END.toLocalTime());
        reservation.setStatus(status);
        return reservation;
    }

    private static UsageRecord usage(LocalDateTime checkIn, LocalDateTime checkOut) {
        UsageRecord usage = new UsageRecord();
        usage.setCheckInAt(checkIn);
        usage.setCheckOutAt(checkOut);
        return usage;
    }

    private DisplayStatus confirmed(LocalDateTime now) {
        return calculator.of(reservation(ReservationStatus.CONFIRMED), null, now);
    }

    @Test
    void nonConfirmedStatusesPassThroughUnchanged() {
        assertThat(calculator.of(reservation(ReservationStatus.CANCELLED), null, START))
                .isEqualTo(DisplayStatus.CANCELLED);
        assertThat(calculator.of(reservation(ReservationStatus.ADMIN_CANCELLED), null, START))
                .isEqualTo(DisplayStatus.ADMIN_CANCELLED);
        assertThat(calculator.of(reservation(ReservationStatus.NO_SHOW), null, START.minusDays(1)))
                .isEqualTo(DisplayStatus.NO_SHOW);
        assertThat(calculator.of(reservation(ReservationStatus.COMPLETED), usage(START, null), START))
                .isEqualTo(DisplayStatus.COMPLETED);
    }

    @Test
    void checkInWindowIsClosedAtBothEnds() {
        LocalDateTime opens = START.minusMinutes(defaults.checkinOpenBeforeMinutes());
        LocalDateTime closes = START.plusMinutes(defaults.checkinCloseAfterMinutes());

        assertThat(confirmed(opens.minusSeconds(1))).isEqualTo(DisplayStatus.UPCOMING);
        assertThat(confirmed(opens)).isEqualTo(DisplayStatus.CHECKIN_OPEN);
        assertThat(confirmed(START)).isEqualTo(DisplayStatus.CHECKIN_OPEN);
        assertThat(confirmed(closes)).isEqualTo(DisplayStatus.CHECKIN_OPEN);
        assertThat(confirmed(closes.plusSeconds(1))).isEqualTo(DisplayStatus.NO_SHOW);
    }

    @Test
    void checkedInBecomesCompletedExactlyAtTheEnd() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        UsageRecord checkedIn = usage(START.minusMinutes(5), null);
        UsageRecord checkedOut = usage(START.minusMinutes(5), START.plusMinutes(60));

        assertThat(calculator.of(reservation, checkedIn, END.minusSeconds(1))).isEqualTo(DisplayStatus.IN_USE);
        assertThat(calculator.of(reservation, checkedOut, END.minusSeconds(1))).isEqualTo(DisplayStatus.CHECKED_OUT);
        assertThat(calculator.of(reservation, checkedIn, END)).isEqualTo(DisplayStatus.COMPLETED);
        assertThat(calculator.of(reservation, checkedOut, END)).isEqualTo(DisplayStatus.COMPLETED);
    }

    @Test
    void checkedInBeforeTheSlotStartsIsInUseNotUpcoming() {
        UsageRecord checkedIn = usage(START.minusMinutes(10), null);

        assertThat(calculator.of(reservation(ReservationStatus.CONFIRMED), checkedIn, START.minusMinutes(10)))
                .isEqualTo(DisplayStatus.IN_USE);
    }

    @Test
    void windowBoundsComeFromBookingProperties() {
        DisplayStatusCalculator custom = new DisplayStatusCalculator(properties(20, 10));
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);

        assertThat(custom.of(reservation, null, START.minusMinutes(20))).isEqualTo(DisplayStatus.CHECKIN_OPEN);
        assertThat(custom.of(reservation, null, START.minusMinutes(20).minusSeconds(1)))
                .isEqualTo(DisplayStatus.UPCOMING);
        assertThat(custom.of(reservation, null, START.plusMinutes(10))).isEqualTo(DisplayStatus.CHECKIN_OPEN);
        assertThat(custom.of(reservation, null, START.plusMinutes(10).plusSeconds(1)))
                .isEqualTo(DisplayStatus.NO_SHOW);
    }

    /** BE-3 E1：有效状态与展示状态同一组判定点；未签到在关闭时刻正好仍为 CONFIRMED，晚 1 秒为 NO_SHOW。 */
    @Test
    void effectiveStatusBecomesNoShowOnlyAfterTheCheckInWindowCloses() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        LocalDateTime closes = START.plusMinutes(defaults.checkinCloseAfterMinutes());

        assertThat(calculator.effectiveStatus(reservation, null, closes)).isEqualTo(ReservationStatus.CONFIRMED);
        assertThat(calculator.effectiveStatus(reservation, null, closes.plusSeconds(1)))
                .isEqualTo(ReservationStatus.NO_SHOW);
        assertThat(calculator.effectiveStatus(reservation, usage(START, null), closes.plusSeconds(1)))
                .isEqualTo(ReservationStatus.CONFIRMED);
    }

    @Test
    void effectiveStatusBecomesCompletedExactlyAtTheEndWhenCheckedIn() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        UsageRecord checkedIn = usage(START, null);

        assertThat(calculator.effectiveStatus(reservation, checkedIn, END.minusSeconds(1)))
                .isEqualTo(ReservationStatus.CONFIRMED);
        assertThat(calculator.effectiveStatus(reservation, checkedIn, END)).isEqualTo(ReservationStatus.COMPLETED);
    }

    @Test
    void effectiveStatusLeavesStoredTerminalStatusesUnchanged() {
        LocalDateTime late = END.plusDays(1);

        for (ReservationStatus status : new ReservationStatus[] {ReservationStatus.CANCELLED,
                ReservationStatus.ADMIN_CANCELLED, ReservationStatus.NO_SHOW, ReservationStatus.COMPLETED}) {
            assertThat(calculator.effectiveStatus(reservation(status), null, late)).isEqualTo(status);
            assertThat(calculator.effectiveStatus(reservation(status), usage(START, null), late)).isEqualTo(status);
        }
    }

    @Test
    void displayStatusAgreesWithEffectiveStatusAfterTheDecisionPoints() {
        Reservation reservation = reservation(ReservationStatus.CONFIRMED);
        LocalDateTime afterClose = START.plusMinutes(defaults.checkinCloseAfterMinutes()).plusSeconds(1);

        assertThat(calculator.of(reservation, null, afterClose).name())
                .isEqualTo(calculator.effectiveStatus(reservation, null, afterClose).name());
        assertThat(calculator.of(reservation, usage(START, null), END).name())
                .isEqualTo(calculator.effectiveStatus(reservation, usage(START, null), END).name());
    }
}
