package com.campus.venue.reservation.service;

import com.campus.venue.common.LikePattern;
import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.reservation.dto.AdminReservationView;
import com.campus.venue.reservation.repository.AdminReservationFilter;
import com.campus.venue.reservation.repository.AdminReservationFilter.StatusCondition;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.reservation.repository.UsageRecordRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 管理端预约列表（docs/12 第 5.7 节，BE-5 A1）。格式与角色在控制器完成；这里依次：给了 venueId 先做授权检查
 * （FORBIDDEN_SCOPE）→ 可见场馆（SYS_ADMIN 全部、VENUE_ADMIN 当前有效授权）→ 过滤 → 倒序 → 数据库分页。
 * 与 mock 的 listReservations、visibleReservations、matchesKeyword（adminReservationService.ts）一致。
 *
 * <p>status 按有效状态过滤（BE-3 E1）。越过判定点的判定只在 DisplayStatusCalculator 一处实现，所以不在 SQL 里复写
 * “开始 + checkInCloseAfter”“结束时刻”这些判定点：库中状态与有效状态只可能在“库中 CONFIRMED 且已开始”的记录上不同，
 * 先在同样的场馆与日期范围内取出这些候选，用 DisplayStatusCalculator 判定后得到将计为 NO_SHOW / COMPLETED 的 id，
 * 再交给 SQL 做集合运算。清扫每分钟落库，正常运行时候选集很小。
 */
@Service
public class AdminReservationQueryService {

    /** 服务日期、开始时间、id 均倒序（mock 的 listReservations）；实际排序在 AdminReservationSearch 中。 */
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "serviceDate", "startTime", "id");

    private final ReservationRepository reservations;
    private final UsageRecordRepository usageRecords;
    private final DisplayStatusCalculator calculator;
    private final ReservationViewMapper mapper;
    private final VenueScopeGuard venueScopeGuard;
    private final Clock clock;

    public AdminReservationQueryService(ReservationRepository reservations, UsageRecordRepository usageRecords,
            DisplayStatusCalculator calculator, ReservationViewMapper mapper, VenueScopeGuard venueScopeGuard,
            Clock clock) {
        this.reservations = reservations;
        this.usageRecords = usageRecords;
        this.calculator = calculator;
        this.mapper = mapper;
        this.venueScopeGuard = venueScopeGuard;
        this.clock = clock;
    }

    /** 列表查询参数（已通过格式校验；keyword 为原值，空白视为未填）。 */
    public record Query(Long venueId, LocalDate dateFrom, LocalDate dateTo, ReservationStatus status, String keyword,
            int page, int pageSize) {
    }

    @Transactional(readOnly = true)
    public PageView<AdminReservationView> list(AuthenticatedUser user, Query query) {
        if (query.venueId() != null) {
            venueScopeGuard.requireVenueAccess(user, query.venueId());
        }
        Collection<Long> venueIds = visibleVenueIds(user, query.venueId());
        if (venueIds != null && venueIds.isEmpty()) {
            return new PageView<>(List.of(), query.page(), query.pageSize(), 0);
        }
        LocalDateTime now = LocalDateTime.now(clock);
        AdminReservationFilter scope = new AdminReservationFilter(venueIds, query.dateFrom(), query.dateTo(), null,
                LikePattern.contains(query.keyword()));
        AdminReservationFilter filter = query.status() == null ? scope
                : scope.withStatus(statusCondition(scope, query.status(), now));
        return DatabasePaging.page(query.page(), query.pageSize(), NEWEST_FIRST,
                () -> reservations.countForAdmin(filter),
                request -> reservations.findForAdmin(filter, request),
                slice -> mapper.toAdminViews(slice, now));
    }

    /** null 表示全部场馆（SYS_ADMIN 未给 venueId）。给了 venueId 时已通过授权检查（SYS_ADMIN 传不存在的场馆得空页）。 */
    private Collection<Long> visibleVenueIds(AuthenticatedUser user, Long venueId) {
        if (venueId != null) {
            return List.of(venueId);
        }
        return user.role() == Role.SYS_ADMIN ? null : venueScopeGuard.effectiveVenueIds(user.id());
    }

    /**
     * 有效状态 → 库中状态的集合条件：CONFIRMED = 库中 CONFIRMED 去掉越过判定点的；NO_SHOW / COMPLETED = 库中同名
     * 加上将计为该状态的；两种取消状态不受判定点影响。
     */
    private StatusCondition statusCondition(AdminReservationFilter scope, ReservationStatus status,
            LocalDateTime now) {
        if (status == ReservationStatus.CANCELLED || status == ReservationStatus.ADMIN_CANCELLED) {
            return new StatusCondition(status, List.of(), List.of());
        }
        Overdue overdue = overdue(scope, now);
        return switch (status) {
            case NO_SHOW -> new StatusCondition(status, overdue.noShow(), List.of());
            case COMPLETED -> new StatusCondition(status, overdue.completed(), List.of());
            default -> new StatusCondition(status, List.of(), concat(overdue.noShow(), overdue.completed()));
        };
    }

    /** 库中 CONFIRMED、但有效状态已是 NO_SHOW / COMPLETED（清扫尚未落库）的预约 id。 */
    private record Overdue(List<Long> noShow, List<Long> completed) {
    }

    private Overdue overdue(AdminReservationFilter scope, LocalDateTime now) {
        List<Reservation> started = reservations.findStartedConfirmedForAdmin(scope, now.toLocalDate(),
                now.toLocalTime());
        Map<Long, UsageRecord> usage = usageRecords.mapByReservationId(
                started.stream().map(Reservation::getId).toList());
        Overdue overdue = new Overdue(new ArrayList<>(), new ArrayList<>());
        for (Reservation reservation : started) {
            ReservationStatus effective = calculator.effectiveStatus(reservation, usage.get(reservation.getId()), now);
            if (effective == ReservationStatus.NO_SHOW) {
                overdue.noShow().add(reservation.getId());
            } else if (effective == ReservationStatus.COMPLETED) {
                overdue.completed().add(reservation.getId());
            }
        }
        return overdue;
    }

    private static List<Long> concat(List<Long> first, List<Long> second) {
        List<Long> all = new ArrayList<>(first);
        all.addAll(second);
        return all;
    }
}
