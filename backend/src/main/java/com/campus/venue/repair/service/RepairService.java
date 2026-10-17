package com.campus.venue.repair.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.repair.domain.RepairReport;
import com.campus.venue.repair.domain.RepairStatus;
import com.campus.venue.repair.dto.CreateRepairRequest;
import com.campus.venue.repair.dto.RepairReportView;
import com.campus.venue.repair.repository.RepairReportRepository;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.service.VenueLookup;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户端报修（docs/12 第 5.4 节，BE-6 R1、R2），与 mock contentService.ts 的 createRepair、listMyRepairs 一致。
 * 格式与角色（USER）在控制器完成。
 */
@Service
public class RepairService {

    private final RepairReportRepository repairs;
    private final ResourceRepository resources;
    private final VenueLookup venueLookup;
    private final RepairViewMapper mapper;
    private final Clock clock;

    public RepairService(RepairReportRepository repairs, ResourceRepository resources, VenueLookup venueLookup,
            RepairViewMapper mapper, Clock clock) {
        this.repairs = repairs;
        this.resources = resources;
        this.venueLookup = venueLookup;
        this.mapper = mapper;
        this.clock = clock;
    }

    /**
     * R1：场馆不存在、场地不存在 → NOT_FOUND；场地不属于该场馆 → VALIDATION_ERROR fields.resourceId。
     * 不看场馆、场地状态（关闭的场馆也可报修），不加锁。写入 SUBMITTED，报修人为当前用户；不写管理员日志。
     */
    @Transactional
    public RepairReportView create(long reporterId, CreateRepairRequest request) {
        long venueId = venueLookup.require(request.venueId()).getId();
        if (request.resourceId() != null) {
            Resource resource = resources.findById(request.resourceId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
            if (resource.getVenueId() != venueId) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        Map.of("fields", Map.of("resourceId", "场地不属于该场馆")));
            }
        }
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        RepairReport report = new RepairReport();
        report.setVenueId(venueId);
        report.setResourceId(request.resourceId());
        report.setReporterId(reporterId);
        report.setDescription(request.description());
        report.setStatus(RepairStatus.SUBMITTED);
        report.setCreatedAt(now);
        report.setUpdatedAt(now);
        repairs.saveAndFlush(report);
        return mapper.toView(report);
    }

    /** R2：自己提交的报修（不分页），按提交时刻、id 倒序。 */
    @Transactional(readOnly = true)
    public List<RepairReportView> listMine(long reporterId) {
        return mapper.toViews(repairs.findByReporterIdOrderByCreatedAtDescIdDesc(reporterId));
    }
}
