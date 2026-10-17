package com.campus.venue.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束（BE-5 C1、C2）：管理员覆盖的 reason 缺失或空白时不通过。违反时由 GlobalExceptionHandler 转换为
 * 400 REASON_REQUIRED（不是 VALIDATION_ERROR）。请求体用 @GroupSequence 把它放在 ReasonCheck 组，
 * 于是字段格式错误先报、REASON_REQUIRED 其次，二者都先于方法级角色注解（与 BE-2b 的 CancelReasonRequired 做法相同）。
 */
@Documented
@Constraint(validatedBy = ReasonRequiredValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ReasonRequired {

    String message() default "请填写原因";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
