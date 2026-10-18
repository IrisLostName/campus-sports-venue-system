package com.campus.venue.stats.dto;

import com.campus.venue.stats.domain.ResourceLiveState;
import com.campus.venue.venue.domain.VenueStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 大屏聚合数据（docs/12 第 5.10 节 DisplaySummary，BE-7 D2–D7）。不含任何个人信息：没有用户 id、用户名、姓名、电话、
 * 预约 id 或预约人字段（docs/08 第 3 节第 5 条）。todayUtilizationRate 为 null 表示今天没有开放时段，键仍然存在。
 */
public record DisplaySummary(
        LocalDateTime generatedAt,
        long todayReservationCount,
        long currentInUse,
        Double todayUtilizationRate,
        List<VenueBoard> venues,
        List<ResourceBoard> resources,
        List<TrendPoint> weekTrend,
        List<Notice> notices) {

    /** D3：resourceTotal 为非 DISABLED 场地数；resourceOpen 为 OPEN 场地数；resourcesReservedNow 为 RESERVED 或 IN_USE 的场地数。 */
    public record VenueBoard(long venueId, String venueName, VenueStatus operationalStatus, boolean userBookingEnabled,
            long resourceTotal, long resourceOpen, long resourcesReservedNow) {
    }

    /** D4：场地与其实时状态。 */
    public record ResourceBoard(long venueId, long resourceId, String resourceName, ResourceLiveState state) {
    }

    /** D5：某天的预约量（K1）。 */
    public record TrendPoint(LocalDate date, long reservationCount) {
    }

    /** D6：有效系统公告的 id 与标题。 */
    public record Notice(long id, String title) {
    }
}
