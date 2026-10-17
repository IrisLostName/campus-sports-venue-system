package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.Reservation;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.data.domain.Pageable;

/** 管理端预约列表的动态查询（BE-5 A1），由 ReservationRepository 继承，实现见 AdminReservationSearchImpl。 */
public interface AdminReservationSearch {

    /** 满足条件的预约数。 */
    long countForAdmin(AdminReservationFilter filter);

    /** 满足条件的一页预约：服务日期、开始时间、id 均倒序（与 mock 的 listReservations 一致）。 */
    List<Reservation> findForAdmin(AdminReservationFilter filter, Pageable page);

    /**
     * 有效状态候选：在 filter 的场馆与日期范围内、库中 CONFIRMED 且开始时刻不晚于现在（today + nowTime）的预约。
     * 只有这些记录的有效状态可能与库中状态不同（BE-3 E1）。
     */
    List<Reservation> findStartedConfirmedForAdmin(AdminReservationFilter filter, LocalDate today, LocalTime nowTime);
}
