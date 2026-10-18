package com.campus.venue.stats.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/** 按“场馆 × 日期”累计的计数（K1、K2、K3 共用），可按全部、某场馆、某天求和。 */
final class VenueDayCounts {

    private final Map<Long, Map<LocalDate, Long>> cells = new HashMap<>();

    void add(long venueId, LocalDate date, long count) {
        cells.computeIfAbsent(venueId, id -> new HashMap<>()).merge(date, count, Long::sum);
    }

    long total() {
        return cells.values().stream().flatMap(days -> days.values().stream()).mapToLong(Long::longValue).sum();
    }

    long ofVenue(long venueId) {
        return cells.getOrDefault(venueId, Map.of()).values().stream().mapToLong(Long::longValue).sum();
    }

    long onDay(LocalDate date) {
        return cells.values().stream().mapToLong(days -> days.getOrDefault(date, 0L)).sum();
    }
}
