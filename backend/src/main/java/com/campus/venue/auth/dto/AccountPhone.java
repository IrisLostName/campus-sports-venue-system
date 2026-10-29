package com.campus.venue.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 账号手机号（注册、创建账号与找回密码共用，契约 v1.3）：空白视为未填；非空白时须为 11 位中国大陆手机号
 * （^1\d{10}$，不去空格、不接受分隔符；\d 只匹配 ASCII 数字）。是否必填由各请求另行约束：
 * 注册与找回密码用 @NotBlank，创建 USER 账号用 PhoneRequiredForUser。
 */
@Documented
@Pattern(regexp = "\\s*|1\\d{10}", message = "须为 11 位手机号")
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AccountPhone {

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
