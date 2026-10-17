package com.campus.venue.repair.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束（BE-6 R4，mock updateRepair）：status=RESOLVED 时 resultNote 必填（缺失或空白 →“必填”）、≤ 500；
 * 其他情况可选，给了须非空白（“不能为空”）、≤ 500。违反时报在字段 resultNote 上。
 */
@Documented
@Constraint(validatedBy = ResultNoteMatchesStatusValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ResultNoteMatchesStatus {

    String message() default "resultNote 与 status 不符";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
