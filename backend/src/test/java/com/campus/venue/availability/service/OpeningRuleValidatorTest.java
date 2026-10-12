package com.campus.venue.availability.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.availability.domain.WindowSpec;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * R1–R3：开放规则校验器的每条规则与边界（恰好 90、恰好相接、重叠 1 分钟、0 长度、反向）；
 * reason 与 mock 逐字相同；星期超出 1–7 为 VALIDATION_ERROR（裁决第 10 节第 1 条）。
 */
class OpeningRuleValidatorTest {

    private final OpeningRuleValidator validator = new OpeningRuleValidator();

    private static WindowSpec window(int weekday, String open, String close) {
        return new WindowSpec(weekday, LocalTime.parse(open), LocalTime.parse(close));
    }

    private void assertRuleInvalid(List<WindowSpec> windows, String reason) {
        assertThatThrownBy(() -> validator.validateWeekly(windows))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RULE_INVALID);
                    assertThat(ex.getDetails()).isEqualTo(Map.of("reason", reason));
                });
    }

    private void assertValid(List<WindowSpec> windows) {
        assertThatCode(() -> validator.validateWeekly(windows)).doesNotThrowAnyException();
    }

    @Test
    void reasonsMatchTheMockVerbatim() {
        assertThat(OpeningRuleValidator.REASON_NOT_BEFORE).isEqualTo("开始时间不早于结束时间");
        assertThat(OpeningRuleValidator.REASON_NOT_MULTIPLE).isEqualTo("窗口长度必须是 90 分钟的整数倍");
        assertThat(OpeningRuleValidator.REASON_OVERLAP).isEqualTo("同一星期的窗口不能重叠");
        assertThat(OpeningRuleValidator.REASON_CLOSURE_DATES).isEqualTo("结束日期不能早于开始日期");
    }

    @Test
    void exactlyNinetyMinutesAndWholeDaySeedWindowAreValid() {
        assertValid(List.of(window(1, "08:00", "09:30")));
        assertValid(List.of(window(7, "08:00", "20:00")));
        assertValid(List.of());
    }

    @Test
    void lengthNotAMultipleOfNinetyIsRejected() {
        assertRuleInvalid(List.of(window(1, "08:00", "09:31")), "窗口长度必须是 90 分钟的整数倍");
        assertRuleInvalid(List.of(window(1, "08:00", "20:30")), "窗口长度必须是 90 分钟的整数倍");
    }

    @Test
    void zeroLengthAndReversedWindowsAreRejected() {
        assertRuleInvalid(List.of(window(1, "08:00", "08:00")), "开始时间不早于结束时间");
        assertRuleInvalid(List.of(window(1, "09:30", "08:00")), "开始时间不早于结束时间");
    }

    @Test
    void perWindowChecksRunInInputOrderBeforeOverlap() {
        // 第一个窗口长度非法、第二个反向：按输入顺序先报第一个
        assertRuleInvalid(List.of(window(2, "08:00", "09:00"), window(2, "10:00", "09:00")),
                "窗口长度必须是 90 分钟的整数倍");
        // 重叠且有反向窗口：先报逐个窗口的问题
        assertRuleInvalid(List.of(window(2, "08:00", "11:00"), window(2, "09:30", "11:00"),
                window(3, "12:00", "11:00")), "开始时间不早于结束时间");
    }

    @Test
    void touchingWindowsAreAllowedButOneMinuteOverlapIsNot() {
        assertValid(List.of(window(3, "08:00", "09:30"), window(3, "09:30", "11:00")));
        assertRuleInvalid(List.of(window(3, "08:00", "09:30"), window(3, "09:29", "10:59")),
                "同一星期的窗口不能重叠");
    }

    @Test
    void overlapIsFoundRegardlessOfInputOrder() {
        assertRuleInvalid(List.of(window(4, "14:00", "15:30"), window(4, "08:00", "20:00")),
                "同一星期的窗口不能重叠");
        assertRuleInvalid(List.of(window(4, "08:00", "09:30"), window(5, "08:00", "09:30"),
                window(4, "08:00", "09:30")), "同一星期的窗口不能重叠");
    }

    @Test
    void sameTimesOnDifferentWeekdaysDoNotOverlap() {
        assertValid(List.of(window(1, "08:00", "20:00"), window(2, "08:00", "20:00"),
                window(1, "20:00", "21:30")));
    }

    @Test
    void weekdayOutsideOneToSevenIsAFieldFormatError() {
        for (int weekday : new int[] {0, 8}) {
            List<WindowSpec> windows = List.of(window(1, "08:00", "09:30"), window(weekday, "09:30", "08:00"));
            assertThatThrownBy(() -> validator.validateWeekly(windows))
                    .isInstanceOfSatisfying(BusinessException.class, ex -> {
                        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR);
                        assertThat(ex.getDetails())
                                .isEqualTo(Map.of("fields", Map.of("windows[1].weekday", "应为 1–7 的整数")));
                    });
        }
    }

    @Test
    void closureEndBeforeStartIsRejected() {
        assertThatThrownBy(() -> validator.validateClosure(LocalDate.of(2026, 10, 13), LocalDate.of(2026, 10, 12)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RULE_INVALID);
                    assertThat(ex.getDetails()).isEqualTo(Map.of("reason", "结束日期不能早于开始日期"));
                });
    }

    @Test
    void singleDayAndPastClosuresAreAllowed() {
        LocalDate day = LocalDate.of(2026, 10, 12);
        assertThatCode(() -> validator.validateClosure(day, day)).doesNotThrowAnyException();
        assertThatCode(() -> validator.validateClosure(LocalDate.of(2020, 1, 1), LocalDate.of(2020, 1, 3)))
                .doesNotThrowAnyException();
    }
}
