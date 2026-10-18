package com.campus.venue.stats.service;

import com.campus.venue.availability.service.OpeningCalendar;
import com.campus.venue.venue.domain.Resource;
import java.util.List;
import java.util.Map;

/**
 * “现在”的数据（BE-7 K5、D4）：范围内全部场地（含 DISABLED，按场馆 id、sortOrder、id 升序）、区间的开放日历、
 * 今天各场地的有效预约，以及 K5 当前使用数。
 */
record TodayFacts(List<Resource> resources, OpeningCalendar calendar, Map<Long, List<LiveReservation>> byResource,
        long inUse) {
}
