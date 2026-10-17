package com.campus.venue.user.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.List;

/** VenueIdList 的判定。 */
public class VenueIdListValidator implements ConstraintValidator<VenueIdList, List<Long>> {

    /** 与 mock userService.ts 的 venueIdsProblem 文案一致（格式阶段与存在性检查共用）。 */
    public static final String PROBLEM = "应为已存在场馆 id 组成的数组";

    @Override
    public boolean isValid(List<Long> venueIds, ConstraintValidatorContext context) {
        return venueIds == null || venueIds.stream().allMatch(id -> id != null && id > 0);
    }
}
