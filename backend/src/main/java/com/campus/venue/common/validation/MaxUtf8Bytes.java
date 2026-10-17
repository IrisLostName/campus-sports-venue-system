package com.campus.venue.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 字符串按 UTF-8 编码后的字节数上限；null 视为通过（由 @NotNull 等另行约束）。可用于组合约束（BE-6 AccountPassword）。 */
@Documented
@Constraint(validatedBy = MaxUtf8BytesValidator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface MaxUtf8Bytes {

    int value();

    String message() default "超过允许的字节数";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
