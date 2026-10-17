package com.campus.venue.announcement.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** VenueIdMatchesScope 的判定（mock contentService.ts 的 listAnnouncements、createAnnouncement）。 */
public class VenueIdMatchesScopeValidator implements ConstraintValidator<VenueIdMatchesScope, ScopedVenueId> {

    private static final String VENUE = "VENUE";

    private boolean systemAllowsVenueId;

    @Override
    public void initialize(VenueIdMatchesScope annotation) {
        systemAllowsVenueId = annotation.systemAllowsVenueId();
    }

    @Override
    public boolean isValid(ScopedVenueId request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        String problem = problem(request.scope(), request.venueId());
        if (problem == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(problem).addPropertyNode("venueId").addConstraintViolation();
        return false;
    }

    private String problem(String scope, Long venueId) {
        if (VENUE.equals(scope)) {
            if (venueId == null) {
                return "必填";
            }
            return venueId > 0 ? null : "应为正整数";
        }
        if (venueId == null) {
            return null;
        }
        if (!systemAllowsVenueId) {
            return "SYSTEM 公告不应带 venueId";
        }
        return venueId > 0 ? null : "应为正整数";
    }
}
