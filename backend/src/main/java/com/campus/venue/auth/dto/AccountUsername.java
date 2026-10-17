package com.campus.venue.auth.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 账号用户名（注册与创建账号共用，BE-1 A1、BE-6 U2）：必填，3–32 位字母、数字或下划线。各组成约束分别报告自己的文案。 */
@Documented
@NotNull(message = "必填")
@Pattern(regexp = "^[A-Za-z0-9_]{3,32}$", message = "须为 3–32 位字母、数字或下划线")
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AccountUsername {

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
