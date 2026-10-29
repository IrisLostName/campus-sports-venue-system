package com.campus.venue.reservation.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 同行人 id 列表的格式约束（docs/12 第 5.3 节 companionUserIds，契约 v1.2，P2-2b）：至多 6 个、均为正整数、互不相同、
 * 不含本人；任何一条不满足都只报在字段 companionUserIds 上（每次只报第一条问题）。null 视为未填，空数组合法。
 * “存在、ACTIVE、USER”属于业务阶段（docs/10 第 1 节步骤 8a），不在这里检查。
 */
@Documented
@Constraint(validatedBy = CompanionUserIdsValidator.class)
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface CompanionUserIds {

    String message() default "同行人不合法";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
