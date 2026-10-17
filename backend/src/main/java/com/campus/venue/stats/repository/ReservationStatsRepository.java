package com.campus.venue.stats.repository;

import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * 统计的聚合查询（BE-7 K1、K2、K6；docs/13 第 4 节：从 reservation 计算，不建汇总表）。每个方法一条 SQL，
 * 按“场馆 × 日期 × 状态”分组计数，结果行数至多为 场馆数 × 天数 × 5；预约所属场馆经场地取得。
 */
public interface ReservationStatsRepository extends Repository<Reservation, Long> {

    /**
     * K1：created_at 在 [start, end) 内的预约，按场馆、创建日期（created_at 的日期部分，即服务端时区的本地日期）、
     * 状态计数；含已取消。
     */
    @Query("select res.venueId as venueId, cast(r.createdAt as LocalDate) as statDate, r.status as status,"
            + " count(r) as total from Reservation r join Resource res on res.id = r.resourceId"
            + " where res.venueId in :venueIds and r.createdAt >= :start and r.createdAt < :end"
            + " group by res.venueId, cast(r.createdAt as LocalDate), r.status")
    List<StatusCount> countByCreatedDate(@Param("venueIds") Collection<Long> venueIds,
            @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /** K2、K6：service_date 在 [from, to] 内的预约，按场馆、服务日期、状态计数（含全部状态，由调用方取舍）。 */
    @Query("select res.venueId as venueId, r.serviceDate as statDate, r.status as status, count(r) as total"
            + " from Reservation r join Resource res on res.id = r.resourceId"
            + " where res.venueId in :venueIds and r.serviceDate >= :from and r.serviceDate <= :to"
            + " group by res.venueId, r.serviceDate, r.status")
    List<StatusCount> countByServiceDate(@Param("venueIds") Collection<Long> venueIds,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** 分组计数的投影。 */
    interface StatusCount {
        Long getVenueId();

        LocalDate getStatDate();

        ReservationStatus getStatus();

        long getTotal();
    }
}
