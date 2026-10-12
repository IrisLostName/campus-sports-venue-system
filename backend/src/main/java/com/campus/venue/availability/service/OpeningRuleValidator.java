package com.campus.venue.availability.service;

import com.campus.venue.availability.domain.WindowSpec;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.service.BookingRulesService;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 开放规则校验（BE-2a R1、R2，裁决第 10 节第 1 条；docs/03 第 3 节第 3 条）。供 BE-2b 的周窗口替换与特殊关闭使用。
 * 校验顺序与文案取自前端 mock ruleService.ts（windowChecks、ruleViolation、addClosure）。
 */
@Component
public class OpeningRuleValidator {

    static final String REASON_NOT_BEFORE = "开始时间不早于结束时间";
    static final String REASON_NOT_MULTIPLE = "窗口长度必须是 " + BookingRulesService.SLOT_MINUTES + " 分钟的整数倍";
    static final String REASON_OVERLAP = "同一星期的窗口不能重叠";
    static final String REASON_CLOSURE_DATES = "结束日期不能早于开始日期";
    static final String WEEKDAY_MESSAGE = "应为 1–7 的整数";
    private static final int MONDAY = 1;
    private static final int SUNDAY = 7;

    /**
     * 每周窗口整体校验：先查星期格式（VALIDATION_ERROR，字段 windows[i].weekday，属防御性检查），
     * 再逐个窗口查“开始早于结束”“长度为 90 分钟整数倍”，最后按星期、开始时间排序后查同一星期的重叠（首尾相接允许）。
     */
    public void validateWeekly(List<WindowSpec> windows) {
        for (int i = 0; i < windows.size(); i++) {
            int weekday = windows.get(i).weekday();
            if (weekday < MONDAY || weekday > SUNDAY) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        Map.of("fields", Map.of("windows[" + i + "].weekday", WEEKDAY_MESSAGE)));
            }
        }
        for (WindowSpec window : windows) {
            long minutes = Duration.between(window.openTime(), window.closeTime()).toMinutes();
            if (!window.closeTime().isAfter(window.openTime())) {
                throw ruleInvalid(REASON_NOT_BEFORE);
            }
            if (minutes % BookingRulesService.SLOT_MINUTES != 0) {
                throw ruleInvalid(REASON_NOT_MULTIPLE);
            }
        }
        List<WindowSpec> ordered = windows.stream()
                .sorted(Comparator.comparingInt(WindowSpec::weekday).thenComparing(WindowSpec::openTime))
                .toList();
        for (int i = 1; i < ordered.size(); i++) {
            WindowSpec previous = ordered.get(i - 1);
            WindowSpec current = ordered.get(i);
            if (previous.weekday() == current.weekday() && current.openTime().isBefore(previous.closeTime())) {
                throw ruleInvalid(REASON_OVERLAP);
            }
        }
    }

    /** 特殊关闭：结束日期早于开始日期 → RULE_INVALID；相等为单日关闭；不禁止过去日期（FE-1 裁决 A8）。 */
    public void validateClosure(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw ruleInvalid(REASON_CLOSURE_DATES);
        }
    }

    private static BusinessException ruleInvalid(String reason) {
        return new BusinessException(ErrorCode.RULE_INVALID, Map.of("reason", reason));
    }
}
