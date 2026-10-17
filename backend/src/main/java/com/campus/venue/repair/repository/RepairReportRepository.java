package com.campus.venue.repair.repository;

import com.campus.venue.repair.domain.RepairReport;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 报修读写（docs/13 第 3.8 节）。管理端列表的动态条件见 RepairAdminService（Specification）。 */
public interface RepairReportRepository extends JpaRepository<RepairReport, Long>,
        JpaSpecificationExecutor<RepairReport> {

    /** 某用户提交的报修，按提交时刻、id 倒序（mock listMyRepairs）。 */
    List<RepairReport> findByReporterIdOrderByCreatedAtDescIdDesc(Long reporterId);

    /** 锁定报修行（SELECT … FOR UPDATE）：同一报修的处理串行（BE-6 R4）。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RepairReport r where r.id = :id")
    Optional<RepairReport> lockById(@Param("id") Long id);
}
