package com.campus.venue.reservation.service;

import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.dto.ReservationView;
import com.campus.venue.reservation.repository.ReservationRepository;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.repository.ResourceRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 预约读取（docs/12 第 5.3 节，BE-3 M1–M3、D1）：我的预约与预约详情。读取接口不写库（落库是 BE-4 清扫的事）。
 * 做法与 mock 的 listMyReservations、getReservation（frontend/src/api/mock/reservationService.ts）一致。
 */
@Service
public class ReservationQueryService {

    /** 我的预约的范围（docs/12 第 5.3 节）。 */
    public enum Scope { CURRENT, HISTORY, ALL }

    /** HISTORY、ALL 的排序：服务日期、开始时间、id 倒序（mock 的 newestFirst，FE-1 裁决 A14）。 */
    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "serviceDate", "startTime", "id");

    private final ReservationRepository reservations;
    private final ResourceRepository resources;
    private final HeldReservations heldReservations;
    private final ReservationViewMapper mapper;
    private final VenueScopeGuard venueScopeGuard;
    private final Clock clock;

    public ReservationQueryService(ReservationRepository reservations, ResourceRepository resources,
            HeldReservations heldReservations, ReservationViewMapper mapper, VenueScopeGuard venueScopeGuard,
            Clock clock) {
        this.reservations = reservations;
        this.resources = resources;
        this.heldReservations = heldReservations;
        this.mapper = mapper;
        this.venueScopeGuard = venueScopeGuard;
        this.clock = clock;
    }

    /**
     * M2：CURRENT = 当前持有（有效状态 CONFIRMED 且未结束），升序；HISTORY = 其余，倒序；ALL = 全部，倒序。
     * CURRENT 的候选集很小（见 HeldReservations），在内存中分页；HISTORY、ALL 在数据库中分页。
     */
    @Transactional(readOnly = true)
    public PageView<ReservationView> listMine(AuthenticatedUser user, Scope scope, int page, int pageSize) {
        LocalDateTime now = LocalDateTime.now(clock);
        if (scope == Scope.CURRENT) {
            List<Reservation> held = heldReservations.of(user.id(), now);
            long from = (long) (page - 1) * pageSize;
            List<Reservation> slice = from >= held.size() ? List.of()
                    : held.subList((int) from, (int) Math.min(held.size(), from + pageSize));
            return new PageView<>(mapper.toViews(slice, now), page, pageSize, held.size());
        }
        List<Long> heldIds = scope == Scope.ALL ? List.of()
                : heldReservations.of(user.id(), now).stream().map(Reservation::getId).toList();
        if (heldIds.isEmpty()) {
            return DatabasePaging.page(page, pageSize, NEWEST_FIRST, () -> reservations.countByUserId(user.id()),
                    request -> reservations.findByUserId(user.id(), request), slice -> mapper.toViews(slice, now));
        }
        return DatabasePaging.page(page, pageSize, NEWEST_FIRST,
                () -> reservations.countByUserIdAndIdNotIn(user.id(), heldIds),
                request -> reservations.findByUserIdAndIdNotIn(user.id(), heldIds, request),
                slice -> mapper.toViews(slice, now));
    }

    /**
     * D1：预约不存在 NOT_FOUND → USER 非本人 NOT_OWNER / VENUE_ADMIN 越权 FORBIDDEN_SCOPE（场馆为预约场地所属场馆）
     * / SYS_ADMIN 通过。
     */
    @Transactional(readOnly = true)
    public ReservationView get(AuthenticatedUser user, long id) {
        Reservation reservation = reservations.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (user.role() == Role.USER && reservation.getUserId() != user.id()) {
            throw new BusinessException(ErrorCode.NOT_OWNER);
        }
        if (user.role() == Role.VENUE_ADMIN) {
            long venueId = resources.findById(reservation.getResourceId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND)).getVenueId();
            venueScopeGuard.requireVenueAccess(user, venueId);
        }
        return mapper.toView(reservation, LocalDateTime.now(clock));
    }
}
