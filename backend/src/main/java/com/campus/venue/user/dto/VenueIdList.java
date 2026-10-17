package com.campus.venue.user.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 场馆 id 数组的格式（BE-6 U2、U4，计划闸门第 3 条）：元素须为正整数（null 元素或非正 → 不通过）；数组本身为 null 视为通过
 * （必填由 @NotNull 另行约束）。场馆是否存在在角色检查之后查库（文案相同，API-SYNC）。
 */
@Documented
@Constraint(validatedBy = VenueIdListValidator.class)
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface VenueIdList {

    String message() default VenueIdListValidator.PROBLEM;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
