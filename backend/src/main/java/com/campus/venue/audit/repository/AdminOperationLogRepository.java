package com.campus.venue.audit.repository;

import com.campus.venue.audit.domain.AdminOperationLog;
import org.springframework.data.jpa.repository.JpaRepository;

/** 管理员操作日志（docs/13 第 3.10 节），只增不改。 */
public interface AdminOperationLogRepository extends JpaRepository<AdminOperationLog, Long> {
}
