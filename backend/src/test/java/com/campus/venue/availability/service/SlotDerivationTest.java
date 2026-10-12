package com.campus.venue.availability.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.SlotStatus;
import com.campus.venue.availability.service.SlotDerivation.SlotFacts;
import com.campus.venue.availability.service.SlotDerivation.SlotTime;
import com.campus.venue.reservation.domain.Reservation;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** D1、D3 的纯计算：多窗口切分与排序、零头不产生时段、PAST 边界、状态优先级。 */
class SlotDerivationTest {

    private static AvailabilityRule weekly(String open, String close) {
        AvailabilityRule rule = new AvailabilityRule();
        rule.setOpenTime(LocalTime.parse(open));
        rule.setCloseTime(LocalTime.parse(close));
        return rule;
    }

    private static List<String> starts(List<SlotTime> slots) {
        return slots.stream().map(slot -> slot.start() + "-" + slot.end()).toList();
    }

    private static Reservation heldBy(long userId) {
        Reservation reservation = new Reservation();
        reservation.setUserId(userId);
        return reservation;
    }

    @Test
    void windowsAreSlicedIntoNinetyMinuteSlotsSortedByStart() {
        List<SlotTime> slots = SlotDerivation.slice(List.of(weekly("14:00", "17:00"), weekly("08:00", "11:00")));

        assertThat(starts(slots)).containsExactly("08:00-09:30", "09:30-11:00", "14:00-15:30", "15:30-17:00");
    }

    @Test
    void remainderShorterThanNinetyMinutesYieldsNoSlot() {
        assertThat(starts(SlotDerivation.slice(List.of(weekly("08:00", "11:59")))))
                .containsExactly("08:00-09:30", "09:30-11:00");
        assertThat(SlotDerivation.slice(List.of(weekly("08:00", "09:29")))).isEmpty();
    }

    @Test
    void seedWindowYieldsEightSlots() {
        assertThat(starts(SlotDerivation.slice(List.of(weekly("08:00", "20:00"))))).containsExactly(
                "08:00-09:30", "09:30-11:00", "11:00-12:30", "12:30-14:00",
                "14:00-15:30", "15:30-17:00", "17:00-18:30", "18:30-20:00");
    }

    @Test
    void slotStartingExactlyNowIsPast() {
        LocalDate day = LocalDate.of(2026, 10, 12);
        LocalTime start = LocalTime.of(9, 30);

        assertThat(SlotDerivation.isPast(day, start, LocalDateTime.of(day, start))).isTrue();
        assertThat(SlotDerivation.isPast(day, start, LocalDateTime.of(day, start).minusSeconds(1))).isFalse();
    }

    @Test
    void priorityIsPastThenBookedThenClosedThenAvailable() {
        assertThat(SlotDerivation.resolve(new SlotFacts(true, heldBy(1), true), 1L)).isEqualTo(SlotStatus.PAST);
        assertThat(SlotDerivation.resolve(new SlotFacts(false, heldBy(2), true), 1L)).isEqualTo(SlotStatus.BOOKED);
        assertThat(SlotDerivation.resolve(new SlotFacts(false, heldBy(1), true), 1L)).isEqualTo(SlotStatus.MINE);
        assertThat(SlotDerivation.resolve(new SlotFacts(false, null, true), 1L)).isEqualTo(SlotStatus.CLOSED);
        assertThat(SlotDerivation.resolve(new SlotFacts(false, null, false), 1L)).isEqualTo(SlotStatus.AVAILABLE);
    }

    @Test
    void adminViewNeverYieldsMine() {
        assertThat(SlotDerivation.resolve(new SlotFacts(false, heldBy(1), false), null)).isEqualTo(SlotStatus.BOOKED);
    }
}
