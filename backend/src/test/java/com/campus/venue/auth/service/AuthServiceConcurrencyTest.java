package com.campus.venue.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.auth.dto.RegisterRequest;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

/** A1：并发注册同名只成功一个，其余 USERNAME_TAKEN；唯一约束冲突的识别只认 23505 + uq_app_user_username。 */
class AuthServiceConcurrencyTest extends AbstractApiTest {

    private static final int THREADS = 5;

    @Autowired
    private AuthService authService;

    @Autowired
    private AppUserRepository users;

    @Test
    void concurrentRegistrationsOfOneUsernameYieldExactlyOneUser() throws Exception {
        CountDownLatch ready = new CountDownLatch(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        List<Future<ErrorCode>> outcomes = new ArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                outcomes.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    try {
                        authService.register(new RegisterRequest("racer", "Passw0rd!", "抢注", null, null));
                        return null;
                    } catch (BusinessException ex) {
                        return ex.getErrorCode();
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<ErrorCode> codes = new ArrayList<>();
            for (Future<ErrorCode> outcome : outcomes) {
                codes.add(outcome.get(30, TimeUnit.SECONDS));
            }
            assertThat(codes).filteredOn(code -> code == null).hasSize(1);
            assertThat(codes).filteredOn(code -> code != null).hasSize(THREADS - 1)
                    .containsOnly(ErrorCode.USERNAME_TAKEN);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from app_user where username = 'racer'", Integer.class))
                .isEqualTo(1);
    }

    /** 真实数据库产生的用户名唯一冲突被识别；其他约束（如 NOT NULL）不被当作用户名冲突。 */
    @Test
    void onlyTheUsernameUniqueViolationIsTranslated() {
        TestUsers.insert(jdbc, "taken", Role.USER);

        assertThatThrownBy(() -> users.saveAndFlush(entity("taken", "x")))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class,
                        ex -> assertThat(AuthService.isUsernameConflict(ex)).isTrue());
        assertThatThrownBy(() -> users.saveAndFlush(entity("fresh_name", null)))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class,
                        ex -> assertThat(AuthService.isUsernameConflict(ex)).isFalse());
        assertThat(AuthService.isUsernameConflict(new DataIntegrityViolationException("no cause"))).isFalse();
    }

    private static AppUser entity(String username, String displayName) {
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash("x");
        user.setDisplayName(displayName);
        user.setRole(Role.USER);
        user.setCreatedAt(LocalDateTime.of(2026, 10, 12, 8, 0));
        user.setUpdatedAt(LocalDateTime.of(2026, 10, 12, 8, 0));
        return user;
    }
}
