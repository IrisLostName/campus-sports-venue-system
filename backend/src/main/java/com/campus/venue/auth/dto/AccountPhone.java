package com.campus.venue.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 账号电话（注册与创建账号共用）：空白视为未填；非空白时不超过 20 个字符，不校验格式。 */
@Documented
@Pattern(regexp = "(?s)\\s*|.{0,20}", message = "不能超过 20 个字符")
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AccountPhone {

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
