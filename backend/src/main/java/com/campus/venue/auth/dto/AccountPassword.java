package com.campus.venue.auth.dto;

import com.campus.venue.common.validation.MaxUtf8Bytes;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 账号口令（注册与创建账号共用）：必填，8–64 位；BCrypt 只处理前 72 字节，超过即拒绝（BE-1 裁决第 11 节第 3 条）。 */
@Documented
@NotNull(message = "必填")
@Size(min = 8, max = 64, message = "长度须为 8–64 位")
@MaxUtf8Bytes(value = 72, message = "不能超过 72 字节")
@Constraint(validatedBy = {})
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface AccountPassword {

    String message() default "";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
