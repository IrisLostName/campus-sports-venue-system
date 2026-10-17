package com.campus.venue.announcement.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 类级约束：venueId 随 scope 而定，违反时报在字段 venueId 上（与其他字段一同收集，BE-6 C1）。
 * scope=VENUE：venueId 必填、正整数。其他（SYSTEM、缺失或非法）：systemAllowsVenueId 为 true 时 venueId 可给、
 * 须为正整数（GET /announcements，N1）；为 false 时给了即“SYSTEM 公告不应带 venueId”（POST，N3）。与 mock 一致。
 */
@Documented
@Constraint(validatedBy = VenueIdMatchesScopeValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface VenueIdMatchesScope {

    boolean systemAllowsVenueId();

    String message() default "venueId 与 scope 不符";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
