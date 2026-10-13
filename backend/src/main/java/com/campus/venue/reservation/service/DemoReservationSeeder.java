package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 演示预约（docs/13 第 5.5 节，BE-3 R1）：只在 demo profile 生效，应用启动时运行；仅当 reservation 表为空时插入
 * zhangsan 明天 网球场1 08:00、lisi 明天 网球场2 09:30（与 mock 的 seedReservations 一致，FE-1 裁决 A12）；wangwu 无预约。
 * “明天”与时间戳取 Clock。预约日期相对今天，所以不写进 Flyway。种子数据不走九步校验。
 * 演示账号或场地缺失时记录警告并跳过，不阻止启动（BE-3 裁决第 12 节第 6 条）。
 */
@Service
@Profile("demo")
public class DemoReservationSeeder implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DemoReservationSeeder.class);
    private static final String VENUE_NAME = "网球馆";

    /** 一条演示预约：预约人用户名、场地名、开始时刻。 */
    private record Seed(String username, String resourceName, LocalTime start) {
    }

    private static final List<Seed> SEEDS = List.of(
            new Seed("zhangsan", "网球场1", LocalTime.of(8, 0)),
            new Seed("lisi", "网球场2", LocalTime.of(9, 30)));

    private final ReservationRepository reservations;
    private final AppUserRepository users;
    private final VenueRepository venues;
    private final ResourceRepository resources;
    private final Clock clock;

    public DemoReservationSeeder(ReservationRepository reservations, AppUserRepository users, VenueRepository venues,
            ResourceRepository resources, Clock clock) {
        this.reservations = reservations;
        this.users = users;
        this.venues = venues;
        this.resources = resources;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (reservations.count() > 0) {
            return;
        }
        Optional<Venue> venue = venues.findByName(VENUE_NAME);
        if (venue.isEmpty()) {
            LOG.warn("演示预约跳过：找不到场馆 {}", VENUE_NAME);
            return;
        }
        List<Resource> courts = resources.findByVenueIdOrderBySortOrderAscIdAsc(venue.get().getId());
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        LocalDate tomorrow = now.toLocalDate().plusDays(1);
        for (Seed seed : SEEDS) {
            Optional<AppUser> user = users.findByUsername(seed.username());
            Optional<Resource> court = courts.stream().filter(r -> r.getName().equals(seed.resourceName())).findFirst();
            if (user.isEmpty() || court.isEmpty()) {
                LOG.warn("演示预约跳过：找不到用户 {} 或场地 {}", seed.username(), seed.resourceName());
                continue;
            }
            reservations.save(reservation(user.get().getId(), court.get().getId(), tomorrow, seed.start(), now));
        }
    }

    private static Reservation reservation(long userId, long resourceId, LocalDate date, LocalTime start,
            LocalDateTime now) {
        Reservation reservation = new Reservation();
        reservation.setUserId(userId);
        reservation.setResourceId(resourceId);
        reservation.setServiceDate(date);
        reservation.setStartTime(start);
        reservation.setEndTime(start.plusMinutes(BookingRulesService.SLOT_MINUTES));
        reservation.setStatus(ReservationStatus.CONFIRMED);
        reservation.setCreatedAt(now);
        reservation.setUpdatedAt(now);
        return reservation;
    }
}
