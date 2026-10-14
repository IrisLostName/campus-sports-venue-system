package com.campus.venue.reservation.dto;

import java.util.List;

/** 影响检查报告（docs/12 第 4 节 ImpactReport）：reservations 按预约 id 升序（与 mock 一致）。 */
public record ImpactReport(int affectedCount, List<ReservationBrief> reservations) {
}
