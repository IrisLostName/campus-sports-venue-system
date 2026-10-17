package com.campus.venue.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** ReasonRequired 的判定：与 mock adminReservationService.ts 的 requireReason 一致（缺失或空白即不通过）。 */
public class ReasonRequiredValidator implements ConstraintValidator<ReasonRequired, OverrideReason> {

    @Override
    public boolean isValid(OverrideReason request, ConstraintValidatorContext context) {
        return request == null || request.reason() != null && !request.reason().isBlank();
    }
}
