package com.campus.venue.user.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** PhoneRequiredForUser 的判定：只在 role 恰为 USER 时要求 phone 非空白；role 非法或缺失时由 role 自己的约束报告。 */
public class PhoneRequiredForUserValidator implements ConstraintValidator<PhoneRequiredForUser, CreateUserRequest> {

    @Override
    public boolean isValid(CreateUserRequest request, ConstraintValidatorContext context) {
        if (request == null || !"USER".equals(request.role())
                || (request.phone() != null && !request.phone().isBlank())) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate("必填").addPropertyNode("phone").addConstraintViolation();
        return false;
    }
}
