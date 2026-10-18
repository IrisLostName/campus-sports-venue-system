package com.campus.venue.stats.dto;

/**
 * 校验分组：统计区间的天数检查。StatsOverviewQuery 用 @GroupSequence 把它排在字段格式检查之后，
 * 于是格式错误时不再检查天数（BE-7 O1：格式 → 补缺省区间 → 区间检查 → 角色）。
 */
public interface StatsRangeCheck {
}
