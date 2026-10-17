package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.AdminReservationView;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 预约 → Reservation DTO 的映射（BE-3 S3，BE-4、BE-5 复用）。场地、场馆、预约人、使用记录各一次批量查询，
 * 查询次数不随预约条数增加。status 为有效状态、displayStatus 为展示状态，二者都由 DisplayStatusCalculator 计算。
 * 字段与 mock 的 toReservation（frontend/src/api/mock/reservationView.ts）一致。事务由调用方提供。
 */
@Component
public class ReservationViewMapper {

    private final ResourceRepository resources;
    private final VenueRepository venues;
    private final AppUserRepository users;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;

    public ReservationViewMapper(ResourceRepository resources, VenueRepository venues, AppUserRepository users,
            UsageRecordRepository usageRecords, DisplayStatusCalculator calculator) {
        this.resources = resources;
        this.venues = venues;
        this.users = users;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
    }

    /** 一次映射所需的关联数据。 */
    private record Related(Map<Long, Resource> resources, Map<Long, Venue> venues, Map<Long, AppUser> users,
            Map<Long, UsageRecord> usage) {
    }

    public ReservationView toView(Reservation reservation, LocalDateTime now) {
        return toViews(List.of(reservation), now).get(0);
    }

    /** 保持传入顺序。now 为业务时区的当前本地时间（每个请求只取一次 Clock）。 */
    public List<ReservationView> toViews(List<Reservation> list, LocalDateTime now) {
        if (list.isEmpty()) {
            return List.of();
        }
        Related related = related(list);
        return list.stream().map(reservation -> view(reservation, related, now)).toList();
    }

    /**
     * 管理端 AdminReservation（docs/12 第 5.7 节，BE-5 A1）：Reservation 加预约人的 userUsername、userPhone，
     * 与 mock 的 toAdminReservation 一致；关联数据与 toViews 同样批量读取。
     */
    public List<AdminReservationView> toAdminViews(List<Reservation> list, LocalDateTime now) {
        if (list.isEmpty()) {
            return List.of();
        }
        Related related = related(list);
        return list.stream().map(reservation -> {
            AppUser user = related.users().get(reservation.getUserId());
            return new AdminReservationView(view(reservation, related, now), user.getUsername(), user.getPhone());
        }).toList();
    }

    private Related related(List<Reservation> list) {
        Map<Long, Resource> resourceMap = byId(resources.findAllById(distinct(list, Reservation::getResourceId)),
                Resource::getId);
        Map<Long, Venue> venueMap = byId(venues.findAllById(resourceMap.values().stream()
                .map(Resource::getVenueId).distinct().toList()), Venue::getId);
        Map<Long, AppUser> userMap = byId(users.findAllById(distinct(list, Reservation::getUserId)), AppUser::getId);
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(distinct(list, Reservation::getId));
        return new Related(resourceMap, venueMap, userMap, usage);
    }

    private ReservationView view(Reservation reservation, Related related, LocalDateTime now) {
        Resource resource = related.resources().get(reservation.getResourceId());
        Venue venue = related.venues().get(resource.getVenueId());
        AppUser user = related.users().get(reservation.getUserId());
        UsageRecord usage = related.usage().get(reservation.getId());
        return new ReservationView(reservation.getId(), venue.getId(), venue.getName(),
                resource.getId(), resource.getName(), user.getId(), user.getDisplayName(),
                reservation.getServiceDate(), reservation.getStartTime(), reservation.getEndTime(),
                calculator.effectiveStatus(reservation, usage, now), calculator.of(reservation, usage, now),
                reservation.getPurpose(), reservation.getCreatedAt(),
                reservation.getCancelledAt(), reservation.getCancelReason(), reservation.getCancelledBy(),
                reservation.getAdminNote(),
                usage == null ? null : usage.getCheckInAt(), usage == null ? null : usage.getCheckOutAt());
    }

    private static Collection<Long> distinct(List<Reservation> list, Function<Reservation, Long> key) {
        return list.stream().map(key).distinct().toList();
    }

    private static <T> Map<Long, T> byId(List<T> rows, Function<T, Long> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }
}
