package com.campus.venue.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束（BE-2b 裁决 I2，docs/12 第 5.5 节第 4 条）：非 dryRun、onExistingReservations=CANCEL 且 reason 空白时不通过。
 * 违反时由 GlobalExceptionHandler 转换为 400 REASON_REQUIRED（不是 VALIDATION_ERROR）。
 * 请求体在请求体阶段完成这项检查，先于方法级角色注解（FE-1 裁决 N-4/C8）。
 */
@Documented
@Constraint(validatedBy = CancelReasonRequiredValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface CancelReasonRequired {

    String message() default "请填写原因";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
