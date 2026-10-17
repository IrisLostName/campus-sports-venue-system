package com.campus.venue.user.dto;

import com.campus.venue.audit.service.VenueScopeReplacer;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.List;

/** VenueIdList 的判定。 */
public class VenueIdListValidator implements ConstraintValidator<VenueIdList, List<Long>> {

    /** 与 mock userService.ts 的 venueIdsProblem 文案一致。 */
    public static final String PROBLEM = VenueScopeReplacer.VENUE_IDS_PROBLEM;

    @Override
    public boolean isValid(List<Long> venueIds, ConstraintValidatorContext context) {
        return venueIds == null || venueIds.stream().allMatch(id -> id != null && id > 0);
    }
}
