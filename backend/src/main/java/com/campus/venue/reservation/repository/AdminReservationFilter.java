package com.campus.venue.reservation.repository;

import com.campus.venue.reservation.domain.ReservationStatus;
import java.time.LocalDate;
import java.util.Collection;

/**
 * 管理端预约列表的过滤条件（docs/12 第 5.7 节，BE-5 A1）。各项为 null 表示不过滤。
 *
 * @param venueIds 可见场馆（null = 全部场馆，仅 SYS_ADMIN 未传 venueId 时）
 * @param dateFrom 服务日期下限（含）
 * @param dateTo 服务日期上限（含）
 * @param status 状态条件
 * @param keywordPattern 已转义并带首尾 % 的 LIKE 模式（转义符为反斜杠），匹配用户名、姓名、场地名
 */
public record AdminReservationFilter(Collection<Long> venueIds, LocalDate dateFrom, LocalDate dateTo,
        StatusCondition status, String keywordPattern) {

    /**
     * 状态条件：(库中状态 = stored 且 id 不在 exceptIds 中) 或 id 在 alsoIds 中。
     * 有效状态由服务层用 DisplayStatusCalculator 算出 alsoIds、exceptIds，这里只做集合运算。
     */
    public record StatusCondition(ReservationStatus stored, Collection<Long> alsoIds, Collection<Long> exceptIds) {
    }

    /** 同样的场馆与日期范围，不带状态与关键字（有效状态候选查询用）。 */
    public AdminReservationFilter scopeOnly() {
        return new AdminReservationFilter(venueIds, dateFrom, dateTo, null, null);
    }

    public AdminReservationFilter withStatus(StatusCondition condition) {
        return new AdminReservationFilter(venueIds, dateFrom, dateTo, condition, keywordPattern);
    }
}
