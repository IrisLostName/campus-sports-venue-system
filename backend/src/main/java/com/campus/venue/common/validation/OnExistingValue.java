package com.campus.venue.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.ReportAsSingleViolation;
import jakarta.validation.constraints.Pattern;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 控制字段 onExistingReservations 的格式（BE-2b 裁决 I1）：可空，非空时须为 KEEP 或 CANCEL。各请求体共用。 */
@Documented
@Pattern(regexp = "KEEP|CANCEL")
@ReportAsSingleViolation
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface OnExistingValue {

    String message() default "须为 KEEP 或 CANCEL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
