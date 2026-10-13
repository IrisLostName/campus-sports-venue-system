package com.campus.venue.venue.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.domain.VenueType;
import com.campus.venue.venue.dto.CreateVenueRequest;
import com.campus.venue.venue.dto.ResourceView;
import com.campus.venue.venue.dto.VenueSummary;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.ResourceRepository.VenueResourceCount;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 场馆与场地的读取、新建场馆（BE-2a A1、A3、A4、A5）。 */
@Service
public class VenueService {

    static final String NAME_CONSTRAINT = "uq_venue_name";
    /** 与 mock adminCreateVenue 的文案一致。 */
    static final String NAME_TAKEN_MESSAGE = "场馆名已存在";

    private final VenueRepository venues;
    private final ResourceRepository resources;
    private final VenueLookup venueLookup;
    private final VenueScopeGuard venueScopeGuard;
    private final Clock clock;

    public VenueService(VenueRepository venues, ResourceRepository resources, VenueLookup venueLookup,
            VenueScopeGuard venueScopeGuard, Clock clock) {
        this.venues = venues;
        this.resources = resources;
        this.venueLookup = venueLookup;
        this.venueScopeGuard = venueScopeGuard;
        this.clock = clock;
    }

    /** A1：全部场馆，按 id 升序。 */
    @Transactional(readOnly = true)
    public List<VenueSummary> listAll() {
        return summaries(venues.findAllByOrderByIdAsc());
    }

    /** A3：SYS_ADMIN 全部（不查授权表）；VENUE_ADMIN 仅当前有效授权的场馆（与 /auth/me 的 venueIds 同一口径），按 id 升序。 */
    @Transactional(readOnly = true)
    public List<VenueSummary> listManageable(AuthenticatedUser user) {
        if (user.role() == Role.SYS_ADMIN) {
            return listAll();
        }
        List<Long> ids = venueScopeGuard.effectiveVenueIds(user.id());
        return ids.isEmpty() ? List.of() : summaries(venues.findAllByIdInOrderByIdAsc(ids));
    }

    /**
     * A4：新场馆 OPEN、userBookingEnabled=false，无场地无规则，不写操作日志（FE-1 裁决 §7-7）。
     * name 按原值保存、不裁剪（与 mock 一致）；空白 location/description 存 NULL；时间戳取 Clock。
     * 重名（含并发撞唯一约束）→ VALIDATION_ERROR，fields.name（与 mock 一致）。
     */
    @Transactional
    public VenueSummary create(CreateVenueRequest request) {
        if (venues.existsByName(request.name())) {
            throw nameTaken();
        }
        Venue venue = newVenue(request);
        try {
            venues.saveAndFlush(venue);
        } catch (DataIntegrityViolationException ex) {
            if (isNameConflict(ex)) {
                throw nameTaken();
            }
            throw ex;
        }
        return toSummary(venue, 0L);
    }

    /** A5：场馆不存在 → NOT_FOUND → 授权范围；返回全部场地（含 DISABLED），按 sortOrder、再按 id 排序。 */
    @Transactional(readOnly = true)
    public List<ResourceView> listResources(AuthenticatedUser user, long venueId) {
        Venue venue = venueLookup.require(venueId);
        venueScopeGuard.requireVenueAccess(user, venue.getId());
        return resources.findByVenueIdOrderBySortOrderAscIdAsc(venue.getId()).stream()
                .map(VenueService::toView)
                .toList();
    }

    private List<VenueSummary> summaries(List<Venue> list) {
        Map<Long, Long> counts = resources.countByVenueExcludingStatus(ResourceStatus.DISABLED).stream()
                .collect(Collectors.toMap(VenueResourceCount::getVenueId, VenueResourceCount::getTotal));
        return list.stream()
                .map(venue -> toSummary(venue, counts.getOrDefault(venue.getId(), 0L)))
                .toList();
    }

    private Venue newVenue(CreateVenueRequest request) {
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        Venue venue = new Venue();
        venue.setName(request.name());
        venue.setVenueType(VenueType.valueOf(request.venueType()));
        venue.setLocation(blankToNull(request.location()));
        venue.setDescription(blankToNull(request.description()));
        venue.setOperationalStatus(VenueStatus.OPEN);
        venue.setUserBookingEnabled(false);
        venue.setCreatedAt(now);
        venue.setUpdatedAt(now);
        return venue;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    static BusinessException nameTaken() {
        return new BusinessException(ErrorCode.VALIDATION_ERROR,
                Map.of("fields", Map.of("name", NAME_TAKEN_MESSAGE)));
    }

    /** 只有 SQLState 23505 且约束名为 uq_venue_name 才算场馆重名，其他约束错误照常抛出。 */
    static boolean isNameConflict(DataIntegrityViolationException ex) {
        return UniqueViolations.isViolationOf(ex, NAME_CONSTRAINT);
    }

    static VenueSummary toSummary(Venue venue, long resourceCount) {
        boolean bookable = venue.getOperationalStatus() == VenueStatus.OPEN && venue.isUserBookingEnabled();
        return new VenueSummary(venue.getId(), venue.getName(), venue.getVenueType(), venue.getLocation(),
                venue.getDescription(), venue.getOperationalStatus(), venue.isUserBookingEnabled(), bookable,
                resourceCount);
    }

    private static ResourceView toView(Resource resource) {
        return new ResourceView(resource.getId(), resource.getVenueId(), resource.getName(),
                resource.getResourceType(), resource.getSortOrder(), resource.getOperationalStatus());
    }
}
