package com.campus.venue.stats.dto;

import com.campus.venue.stats.domain.StatsPeriod;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Clock;
import java.time.LocalDate;

/**
 * StatsDateRange 的判定。“今天”取注入的 Clock（Spring 的 ConstraintValidatorFactory 按构造器注入），
 * 缺省与天数计算与统计服务共用 StatsPeriod。
 */
public class StatsDateRangeValidator implements ConstraintValidator<StatsDateRange, StatsOverviewQuery> {

    /** mock validateStatsRange 的文案。 */
    static final String PROBLEM = "日期范围应为 1–" + StatsPeriod.MAX_DAYS + " 天";

    private final Clock clock;

    public StatsDateRangeValidator(Clock clock) {
        this.clock = clock;
    }

    @Override
    public boolean isValid(StatsOverviewQuery query, ConstraintValidatorContext context) {
        if (query == null
                || StatsPeriod.resolve(query.dateFrom(), query.dateTo(), LocalDate.now(clock)).withinLimit()) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(PROBLEM).addPropertyNode("dateFrom").addConstraintViolation();
        return false;
    }
}
