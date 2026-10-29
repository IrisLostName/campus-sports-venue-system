package com.campus.venue.reservation.dto;

import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.CurrentUser;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

/**
 * {@link CompanionUserIds} 的校验：按 个数 → 正整数 → 不重复 → 不含本人 的顺序报第一条问题。
 * “本人”取自安全上下文（注入 CurrentUser，由 Spring 的校验器工厂创建本类）。未登录的请求在过滤器阶段已被拒绝；
 * 即使没有当前用户，这里也只跳过“不含本人”一项，不抛异常（P2-2b 裁决第 5 节第 5 条）。
 */
public class CompanionUserIdsValidator implements ConstraintValidator<CompanionUserIds, List<Long>> {

    /** 同行人上限（docs/03 第 2 节）。 */
    public static final int MAX_COMPANIONS = 6;

    static final String TOO_MANY = "最多 " + MAX_COMPANIONS + " 人";
    static final String NOT_POSITIVE = "应为正整数";
    static final String DUPLICATE = "不能重复";
    static final String SELF = "不能包含本人";

    private final CurrentUser currentUser;

    public CompanionUserIdsValidator(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @Override
    public boolean isValid(List<Long> ids, ConstraintValidatorContext context) {
        String problem = ids == null ? null : problem(ids);
        if (problem == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(problem).addConstraintViolation();
        return false;
    }

    private String problem(List<Long> ids) {
        if (ids.size() > MAX_COMPANIONS) {
            return TOO_MANY;
        }
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            return NOT_POSITIVE;
        }
        if (new HashSet<>(ids).size() != ids.size()) {
            return DUPLICATE;
        }
        Optional<Long> self = currentUser.find().map(AuthenticatedUser::id);
        if (self.isPresent() && ids.contains(self.get())) {
            return SELF;
        }
        return null;
    }
}
