package com.campus.venue.stats.service;

import com.campus.venue.stats.domain.ResourceLiveState;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 大屏的场地实时状态（BE-7 D4，docs/03 第 4.5 节），与 mock statsService.ts 的 liveState 一致。
 * 只读 StatsFigures 中今天的数据与开放日历（大屏区间含今天），不查库。
 */
@Component
public class LiveStateResolver {

    /**
     * 优先级 DISABLED → MAINTENANCE（场地维护、场馆 CLOSED、或今天有覆盖该场地的 ACTIVE 关闭）→ IN_USE（K5 意义下的使用中）
     * → RESERVED（LiveRules.reserved）→ FREE。venue 为 resource 所属场馆。
     */
    public ResourceLiveState stateOf(Venue venue, Resource resource, StatsFigures figures, LocalDateTime now) {
        if (resource.getOperationalStatus() == ResourceStatus.DISABLED) {
            return ResourceLiveState.DISABLED;
        }
        LocalDate today = now.toLocalDate();
        if (resource.getOperationalStatus() == ResourceStatus.MAINTENANCE
                || venue.getOperationalStatus() == VenueStatus.CLOSED
                || figures.calendar().closedByRule(resource, today)) {
            return ResourceLiveState.MAINTENANCE;
        }
        LocalTime time = now.toLocalTime();
        List<LiveReservation> todays = figures.todayOn(resource.getId());
        if (todays.stream().anyMatch(live -> LiveRules.inUse(live, time))) {
            return ResourceLiveState.IN_USE;
        }
        Optional<LocalTime> currentSlotEnd = figures.calendar().currentSlotEnd(venue.getId(), today, time);
        return todays.stream().anyMatch(live -> LiveRules.reserved(live, time, currentSlotEnd))
                ? ResourceLiveState.RESERVED
                : ResourceLiveState.FREE;
    }
}
