package com.campus.venue.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Size;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 控制字段 reason 的格式（BE-2b 裁决 I1）：可空，≤ 200 个字符（与 mock impact.ts 的 reasonProblem 一致）。各请求体共用。 */
@Documented
@Size(max = 200)
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AdminReason {

    String message() default "不能超过 200 个字符";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
