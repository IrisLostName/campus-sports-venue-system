package com.campus.venue.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 账号用户类型（注册与创建账号共用）：可缺省；给了须为 STUDENT、TEACHER 或 OTHER。以字符串接收，使非法值也能以 VALIDATION_ERROR 指明字段。 */
@Documented
@Pattern(regexp = "STUDENT|TEACHER|OTHER", message = "须为 STUDENT、TEACHER 或 OTHER")
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AccountUserType {

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
