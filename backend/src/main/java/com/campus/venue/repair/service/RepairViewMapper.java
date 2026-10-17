package com.campus.venue.repair.service;

import com.campus.venue.repair.domain.RepairReport;
import com.campus.venue.repair.dto.RepairReportView;
import com.campus.venue.user.service.DisplayNames;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * RepairReport → RepairReportView（BE-6 R5）：场馆名、场地名、报修人姓名各一次批量查询，查询次数不随条数增加。
 * 事务由调用方提供。
 */
@Component
public class RepairViewMapper {

    private final VenueRepository venues;
    private final ResourceRepository resources;
    private final DisplayNames displayNames;

    public RepairViewMapper(VenueRepository venues, ResourceRepository resources, DisplayNames displayNames) {
        this.venues = venues;
        this.resources = resources;
        this.displayNames = displayNames;
    }

    public List<RepairReportView> toViews(List<RepairReport> reports) {
        if (reports.isEmpty()) {
            return List.of();
        }
        Map<Long, String> venueNames = venues.findAllById(ids(reports, RepairReport::getVenueId)).stream()
                .collect(Collectors.toMap(Venue::getId, Venue::getName));
        Set<Long> resourceIds = ids(reports, RepairReport::getResourceId);
        Map<Long, String> resourceNames = resourceIds.isEmpty() ? Map.of()
                : resources.findAllById(resourceIds).stream().collect(Collectors.toMap(Resource::getId,
                        Resource::getName));
        Map<Long, String> reporterNames = displayNames.of(ids(reports, RepairReport::getReporterId));
        return reports.stream().map(report -> new RepairReportView(report.getId(), report.getVenueId(),
                venueNames.get(report.getVenueId()), report.getResourceId(),
                report.getResourceId() == null ? null : resourceNames.get(report.getResourceId()),
                report.getReporterId(), reporterNames.get(report.getReporterId()), report.getDescription(),
                report.getStatus(), report.getResultNote(), report.getCreatedAt(), report.getUpdatedAt())).toList();
    }

    public RepairReportView toView(RepairReport report) {
        return toViews(List.of(report)).get(0);
    }

    private static Set<Long> ids(List<RepairReport> reports, Function<RepairReport, Long> id) {
        return reports.stream().map(id).filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));
    }
}
