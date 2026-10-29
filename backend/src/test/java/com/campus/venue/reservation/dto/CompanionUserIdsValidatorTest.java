package com.campus.venue.reservation.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.CurrentUser;
import com.campus.venue.user.domain.Role;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorFactory;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * P2-2b 裁决第 5 节第 5 条：CompanionUserIds 校验器的单元测试（不启动 Spring）。校验器由自定义工厂注入 CurrentUser 创建，
 * 与运行时 Spring 校验器工厂的做法相同；断言每条问题的文案与顺序，以及没有当前用户时不抛异常、只跳过“不含本人”。
 */
@DisplayName("P2-2b 同行人 id 格式校验器")
class CompanionUserIdsValidatorTest {

    private static final long SELF = 7L;

    private ValidatorFactory factory;
    private Validator validator;

    @BeforeEach
    void buildValidator() {
        ConstraintValidatorFactory defaults = Validation.byDefaultProvider().configure()
                .getDefaultConstraintValidatorFactory();
        CurrentUser currentUser = new CurrentUser();
        factory = Validation.byDefaultProvider().configure()
                .constraintValidatorFactory(new ConstraintValidatorFactory() {
                    @Override
                    public <T extends ConstraintValidator<?, ?>> T getInstance(Class<T> key) {
                        return key == CompanionUserIdsValidator.class
                                ? key.cast(new CompanionUserIdsValidator(currentUser)) : defaults.getInstance(key);
                    }

                    @Override
                    public void releaseInstance(ConstraintValidator<?, ?> instance) {
                        defaults.releaseInstance(instance);
                    }
                }).buildValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterEach
    void cleanUp() {
        SecurityContextHolder.clearContext();
        factory.close();
    }

    private static void signIn(long userId) {
        AuthenticatedUser user = new AuthenticatedUser(userId, "user" + userId, Role.USER);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, List.of()));
    }

    /** companionUserIds 上的问题文案；没有问题时为 null。 */
    private String problem(Long... ids) {
        CreateReservationRequest request = new CreateReservationRequest(1L, LocalDate.of(2026, 10, 13),
                LocalTime.of(9, 30), null, ids == null ? null : Arrays.asList(ids));
        Set<ConstraintViolation<CreateReservationRequest>> violations = validator.validate(request);
        assertThat(violations).allMatch(v -> v.getPropertyPath().toString().equals("companionUserIds"));
        assertThat(violations).hasSizeLessThanOrEqualTo(1);
        return violations.isEmpty() ? null : violations.iterator().next().getMessage();
    }

    @Test
    @DisplayName("null、空数组、6 个互不相同的他人 id 合法")
    void validLists() {
        signIn(SELF);

        assertThat(problem((Long[]) null)).isNull();
        assertThat(problem()).isNull();
        assertThat(problem(1L, 2L, 3L, 4L, 5L, 6L)).isNull();
    }

    @Test
    @DisplayName("7 个：最多 6 人（先于其他问题）")
    void sevenIsTooMany() {
        signIn(SELF);

        assertThat(problem(1L, 2L, 3L, 4L, 5L, 6L, 8L)).isEqualTo("最多 6 人");
        assertThat(problem(0L, 0L, SELF, -1L, null, 2L, 3L)).isEqualTo("最多 6 人");
    }

    @Test
    @DisplayName("null 元素、0、负数：应为正整数（先于重复与本人）")
    void nonPositive() {
        signIn(SELF);

        assertThat(problem(1L, null)).isEqualTo("应为正整数");
        assertThat(problem(0L)).isEqualTo("应为正整数");
        assertThat(problem(-3L, -3L, SELF)).isEqualTo("应为正整数");
    }

    @Test
    @DisplayName("重复 id：不能重复（先于本人）")
    void duplicates() {
        signIn(SELF);

        assertThat(problem(2L, 3L, 2L)).isEqualTo("不能重复");
        assertThat(problem(SELF, SELF)).isEqualTo("不能重复");
    }

    @Test
    @DisplayName("包含本人：不能包含本人")
    void self() {
        signIn(SELF);

        assertThat(problem(2L, SELF)).isEqualTo("不能包含本人");
    }

    @Test
    @DisplayName("没有当前用户时不抛异常：只跳过“不含本人”，其他检查照常")
    void noCurrentUser() {
        SecurityContextHolder.clearContext();

        assertThat(problem(2L, SELF)).isNull();
        assertThat(problem(2L, 2L)).isEqualTo("不能重复");
        assertThat(problem(0L)).isEqualTo("应为正整数");
    }
}
