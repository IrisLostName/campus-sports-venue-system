package com.campus.venue.availability.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.availability.service.SlotDerivation.ClosureScope;
import com.campus.venue.availability.service.SlotDerivation.SlotTime;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-7 重构②（裁决第 9 节）：批量读入的开放日历与逐日读取的旧路径（weeklyFor、closuresCovering + SlotDerivation）
 * 在 14 天内逐日一致；含不同星期的窗口、停用的窗口与关闭、跨区间两端的关闭、整馆与单场地关闭、维护/停用场地、关闭的场馆。
 */
class OpeningCalendarTest extends AbstractApiTest {

    /** 2026-10-12，周一。 */
    private static final LocalDate MONDAY = MutableClock.START.toLocalDate();
    private static final LocalDate LAST = MONDAY.plusDays(13);
    private static final List<LocalTime> PROBES = List.of(LocalTime.of(7, 59, 59), LocalTime.of(8, 0),
            LocalTime.of(9, 29, 59), LocalTime.of(11, 0), LocalTime.of(13, 30), LocalTime.of(14, 29, 59),
            LocalTime.of(19, 59, 59), LocalTime.of(20, 0));

    @Autowired
    private SlotDataReader reader;

    @Autowired
    private VenueRepository venueRepository;

    @Autowired
    private ResourceRepository resourceRepository;

    private long open;
    private long closed;

    @BeforeEach
    void seed() {
        VenueFixtures fixtures = new VenueFixtures(jdbc);
        open = fixtures.bookableVenue("开放馆");
        long court1 = fixtures.resource(open, "1号", 1, "OPEN");
        long court2 = fixtures.resource(open, "2号", 2, "OPEN");
        fixtures.resource(open, "3号", 3, "MAINTENANCE");
        fixtures.resource(open, "4号", 4, "DISABLED");
        fixtures.weekly(open, 1, "08:00", "11:00");
        fixtures.weekly(open, 1, "14:00", "17:00");
        fixtures.weekly(open, 2, "08:00", "20:00");
        fixtures.deactivateRule(fixtures.weekly(open, 3, "09:00", "12:00"));
        fixtures.weekly(open, 3, "13:00", "14:30");
        fixtures.weekly(open, 6, "10:00", "11:30");
        fixtures.closure(open, null, MONDAY.minusDays(2), MONDAY.plusDays(1));
        fixtures.closure(open, court2, MONDAY.plusDays(5), MONDAY.plusDays(6));
        fixtures.closure(open, court1, MONDAY.plusDays(12), MONDAY.plusDays(20));
        fixtures.deactivateRule(fixtures.closure(open, court1, MONDAY.plusDays(7), MONDAY.plusDays(7)));
        closed = fixtures.venue("关闭馆", false, "CLOSED");
        long lane = fixtures.resource(closed, "1道", 1, "OPEN");
        fixtures.weeklyEveryDay(closed, "08:00", "09:30");
        fixtures.closure(closed, lane, MONDAY.plusDays(3), MONDAY.plusDays(3));
    }

    /** 旧路径：逐日查询后由 SlotDerivation 计算的开放时段数。 */
    private int perDayOpenSlots(Venue venue, List<Resource> resources, LocalDate date) {
        int slots = SlotDerivation.slice(reader.weeklyFor(venue.getId(), date)).size();
        ClosureScope closures = SlotDerivation.closureScope(reader.closuresCovering(venue.getId(), date));
        return (int) resources.stream().filter(resource -> !SlotDerivation.unavailable(venue, resource, closures))
                .count() * slots;
    }

    private Optional<LocalTime> perDayCurrentEnd(long venueId, LocalDate date, LocalTime time) {
        return SlotDerivation.slice(reader.weeklyFor(venueId, date)).stream()
                .filter(slot -> !time.isBefore(slot.start()) && time.isBefore(slot.end()))
                .map(SlotTime::end)
                .findFirst();
    }

    @Test
    @DisplayName("14 天内逐日：开放时段数、单场地关闭、当前时段结束时刻与逐日旧路径一致")
    void calendarMatchesThePerDayPathOnEveryDay() {
        OpeningCalendar calendar = reader.openingCalendar(List.of(open, closed), MONDAY, LAST);
        for (long venueId : List.of(open, closed)) {
            Venue venue = venueRepository.findById(venueId).orElseThrow();
            List<Resource> resources = resourceRepository.findByVenueIdOrderBySortOrderAscIdAsc(venueId);
            for (LocalDate date = MONDAY; !date.isAfter(LAST); date = date.plusDays(1)) {
                ClosureScope closures = SlotDerivation.closureScope(reader.closuresCovering(venueId, date));
                assertThat(calendar.openSlots(venue, resources, date)).as("%s %s", venue.getName(), date)
                        .isEqualTo(perDayOpenSlots(venue, resources, date));
                for (Resource resource : resources) {
                    assertThat(calendar.closedByRule(resource, date)).as("%s %s", resource.getName(), date)
                            .isEqualTo(closures.closes(resource));
                }
                for (LocalTime time : PROBES) {
                    assertThat(calendar.currentSlotEnd(venueId, date, time)).as("%s %s %s", venueId, date, time)
                            .isEqualTo(perDayCurrentEnd(venueId, date, time));
                }
            }
        }
    }

    @Test
    @DisplayName("开放馆 14 天的开放时段数：整馆关闭两天、停用窗口与停用关闭不计、单场地关闭只扣该场地")
    void openSlotsOfTheOpenVenueDayByDay() {
        OpeningCalendar calendar = reader.openingCalendar(List.of(open, closed), MONDAY, LAST);
        Venue venue = venueRepository.findById(open).orElseThrow();
        List<Resource> resources = resourceRepository.findByVenueIdOrderBySortOrderAscIdAsc(open);
        List<Integer> perDay = new ArrayList<>();
        for (LocalDate date = MONDAY; !date.isAfter(LAST); date = date.plusDays(1)) {
            perDay.add(calendar.openSlots(venue, resources, date));
        }

        assertThat(perDay).containsExactly(0, 0, 2, 0, 0, 1, 0, 8, 16, 2, 0, 0, 1, 0);
        Venue closedVenue = venueRepository.findById(closed).orElseThrow();
        assertThat(calendar.openSlots(closedVenue, resourceRepository.findByVenueIdOrderBySortOrderAscIdAsc(closed),
                MONDAY.plusDays(2))).isZero();
        assertThat(calendar.currentSlotEnd(closed, MONDAY, LocalTime.of(8, 0))).contains(LocalTime.of(9, 30));
    }

    @Test
    @DisplayName("日期不在已读入区间内时抛 IllegalArgumentException（编程错误，裁决 P3）")
    void datesOutsideTheLoadedRangeAreRejected() {
        OpeningCalendar calendar = reader.openingCalendar(List.of(open), MONDAY, LAST);
        Resource resource = resourceRepository.findByVenueIdOrderBySortOrderAscIdAsc(open).get(0);

        assertThatThrownBy(() -> calendar.closedByRule(resource, MONDAY.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> calendar.currentSlotEnd(open, LAST.plusDays(1), LocalTime.NOON))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("没有场馆时不读规则，日历为空")
    void emptyVenueListGivesAnEmptyCalendar() {
        OpeningCalendar calendar = reader.openingCalendar(List.of(), MONDAY, LAST);

        assertThat(calendar.currentSlotEnd(open, MONDAY.plusDays(7), LocalTime.of(8, 0))).isEmpty();
    }
}
