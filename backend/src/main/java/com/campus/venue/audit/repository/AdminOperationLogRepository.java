package com.campus.venue.audit.repository;

import com.campus.venue.audit.domain.AdminOperationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/** 管理员操作日志（docs/13 第 3.10 节），只增不改。查询的动态条件见 OperationLogQueryService（Specification，BE-6 L1）。 */
public interface AdminOperationLogRepository extends JpaRepository<AdminOperationLog, Long>,
        JpaSpecificationExecutor<AdminOperationLog> {
}
