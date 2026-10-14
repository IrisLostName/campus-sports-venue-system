package com.campus.venue.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** CancelReasonRequired 的判定：与 mock impact.ts 的 requireCancelReason 一致（dryRun 只计算，不要求原因）。 */
public class CancelReasonRequiredValidator implements ConstraintValidator<CancelReasonRequired, ImpactControl> {

    @Override
    public boolean isValid(ImpactControl control, ConstraintValidatorContext context) {
        return control == null || control.dryRunRequested() || !control.cancelRequested()
                || control.reasonOrNull() != null;
    }
}
