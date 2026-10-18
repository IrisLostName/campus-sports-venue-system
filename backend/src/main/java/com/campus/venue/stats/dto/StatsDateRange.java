package com.campus.venue.stats.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束（BE-7 O1，mock validateStatsRange）：补缺省区间（dateTo 缺省为今天、dateFrom 缺省为 dateTo − 6）后，
 * 天数 dateTo − dateFrom + 1 须在 1–366 之间，否则报在字段 dateFrom 上“日期范围应为 1–366 天”。
 * 放在请求参数校验里，是为了在方法级 @PreAuthorize 的角色检查之前完成。
 */
@Documented
@Constraint(validatedBy = StatsDateRangeValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface StatsDateRange {

    String message() default "日期范围不合法";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
