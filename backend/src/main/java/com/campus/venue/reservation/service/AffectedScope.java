package com.campus.venue.reservation.service;

import com.campus.venue.reservation.domain.Reservation;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.function.Predicate;

/**
 * 一次变更的影响范围（BE-2b 裁决第 3 节）：这些场地上、服务日期在 [from, to]（null 表示不限）且满足 extra 的预约。
 * 有效状态与“结束时刻晚于现在”的条件由 AffectedReservationFinder 统一加上。
 */
public record AffectedScope(Collection<Long> resourceIds, LocalDate from, LocalDate to,
        Predicate<Reservation> extra) {

    /** 不做影响检查（例如只改名称、userBookingEnabled 的变化）。 */
    public static AffectedScope none() {
        return new AffectedScope(List.of(), null, null, reservation -> true);
    }

    /** 这些场地上全部受影响预约。 */
    public static AffectedScope resources(Collection<Long> resourceIds) {
        return new AffectedScope(resourceIds, null, null, reservation -> true);
    }

    /** 这些场地上服务日期在 [from, to] 的受影响预约（两端都含）。 */
    public static AffectedScope dates(Collection<Long> resourceIds, LocalDate from, LocalDate to) {
        return new AffectedScope(resourceIds, from, to, reservation -> true);
    }

    /** 这些场地上满足 extra 的受影响预约。 */
    public static AffectedScope matching(Collection<Long> resourceIds, Predicate<Reservation> extra) {
        return new AffectedScope(resourceIds, null, null, extra);
    }
}
