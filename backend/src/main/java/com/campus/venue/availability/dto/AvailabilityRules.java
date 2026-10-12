package com.campus.venue.availability.dto;

import java.util.List;

/** 开放规则读取结果（docs/12 第 5.6 节）：ACTIVE 的每周窗口与特殊关闭。 */
public record AvailabilityRules(List<WeeklyWindow> weekly, List<Closure> closures) {
}
