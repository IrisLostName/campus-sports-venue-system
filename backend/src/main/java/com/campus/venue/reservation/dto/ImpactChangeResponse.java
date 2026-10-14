package com.campus.venue.reservation.dto;

import java.util.List;

/**
 * 带影响检查的变更结果（docs/12 第 4 节 ImpactChangeResponse）：dryRun 时 applied=false、data=null；
 * cancelledIds 为实际被 ADMIN_CANCELLED 的预约 id，dryRun 或 KEEP 时为空。
 */
public record ImpactChangeResponse<T>(boolean applied, ImpactReport impact, List<Long> cancelledIds, T data) {
}
