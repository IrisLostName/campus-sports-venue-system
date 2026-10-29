package com.campus.venue.user.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束（契约 v1.3，SEC-2b 裁决第 6 条）：role=USER 时 phone 必填（缺失或空白 →“必填”）；其他角色可不填，
 * 空白视为未填。格式由字段上的 AccountPhone 检查。违反时报在字段 phone 上。
 */
@Documented
@Constraint(validatedBy = PhoneRequiredForUserValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface PhoneRequiredForUser {

    String message() default "普通用户须填写手机号";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
