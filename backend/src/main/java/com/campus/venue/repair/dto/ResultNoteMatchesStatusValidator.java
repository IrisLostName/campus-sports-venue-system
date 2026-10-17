package com.campus.venue.repair.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** ResultNoteMatchesStatus 的判定。 */
public class ResultNoteMatchesStatusValidator
        implements ConstraintValidator<ResultNoteMatchesStatus, UpdateRepairRequest> {

    private static final int MAX_LENGTH = 500;

    @Override
    public boolean isValid(UpdateRepairRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        String problem = problem("RESOLVED".equals(request.status()), request.resultNote());
        if (problem == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(problem).addPropertyNode("resultNote").addConstraintViolation();
        return false;
    }

    private static String problem(boolean required, String note) {
        if (note == null) {
            return required ? "必填" : null;
        }
        if (note.isBlank()) {
            return required ? "必填" : "不能为空";
        }
        return note.length() > MAX_LENGTH ? "不能超过 500 个字符" : null;
    }
}
