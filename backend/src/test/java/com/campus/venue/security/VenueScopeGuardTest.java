package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * V1：授权范围校验每次查库。撤销、有效期外、未授权场馆 → FORBIDDEN_SCOPE（details.venueId）；
 * USER → FORBIDDEN；SYS_ADMIN 通过。“今天”取可调时钟（2026-10-12）。
 */
class VenueScopeGuardTest extends AbstractApiTest {

    private static final LocalDate TODAY = MutableClock.START.toLocalDate();

    @Autowired
    private VenueScopeGuard guard;

    private long sysAdminId;
    private AuthenticatedUser admin;
    private long tennis;
    private long badminton;
    private long pool;

    @BeforeEach
    void seed() {
        sysAdminId = user("sysadmin", Role.SYS_ADMIN);
        admin = new AuthenticatedUser(user("admin_x", Role.VENUE_ADMIN), "admin_x", Role.VENUE_ADMIN);
        tennis = venue("网球馆");
        badminton = venue("羽毛球馆");
        pool = venue("游泳馆");
    }

    private long venue(String name) {
        return jdbc.queryForObject("insert into venue (name, venue_type) values (?, 'OTHER') returning id",
                Long.class, name);
    }

    private long grant(long adminId, long venueId, String status, LocalDate from, LocalDate to) {
        return jdbc.queryForObject("insert into admin_venue_scope (admin_id, venue_id, status, valid_from, valid_to,"
                + " granted_by) values (?, ?, ?, ?, ?, ?) returning id", Long.class,
                adminId, venueId, status, from, to, sysAdminId);
    }

    private void assertScopeDenied(long venueId) {
        assertThatThrownBy(() -> guard.requireVenueAccess(admin, venueId))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN_SCOPE);
                    assertThat(ex.getDetails()).isEqualTo(Map.of("venueId", venueId));
                });
    }

    private void assertAllowed(long venueId) {
        assertThatCode(() -> guard.requireVenueAccess(admin, venueId)).doesNotThrowAnyException();
    }

    @Test
    void sysAdminPassesForAnyVenue() {
        AuthenticatedUser sysAdmin = new AuthenticatedUser(sysAdminId, "sysadmin", Role.SYS_ADMIN);

        assertThatCode(() -> guard.requireVenueAccess(sysAdmin, tennis)).doesNotThrowAnyException();
        assertThatCode(() -> guard.requireVenueAccess(sysAdmin, 999L)).doesNotThrowAnyException();
    }

    @Test
    void ordinaryUserIsForbidden() {
        AuthenticatedUser user = new AuthenticatedUser(user("zhangsan", Role.USER), "zhangsan", Role.USER);

        assertThatThrownBy(() -> guard.requireVenueAccess(user, tennis))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
                    assertThat(ex.getDetails()).isNull();
                });
    }

    @Test
    void venueAdminPassesOnlyForGrantedVenues() {
        grant(admin.id(), tennis, "ACTIVE", null, null);
        long otherAdmin = user("admin_other", Role.VENUE_ADMIN);
        grant(otherAdmin, badminton, "ACTIVE", null, null);

        assertAllowed(tennis);
        assertScopeDenied(badminton);
        assertScopeDenied(pool);
    }

    /** 撤销后下一次调用即失败（同一个组件实例，证明没有缓存）；重新启用后又通过。 */
    @Test
    void revocationTakesEffectOnTheNextCall() {
        long scope = grant(admin.id(), tennis, "ACTIVE", null, null);
        assertAllowed(tennis);

        jdbc.update("update admin_venue_scope set status = 'REVOKED' where id = ?", scope);
        assertScopeDenied(tennis);

        jdbc.update("update admin_venue_scope set status = 'ACTIVE' where id = ?", scope);
        assertAllowed(tennis);
    }

    /** 有效期两端都含当天；valid_to 过去后的第二天即失效。 */
    @Test
    void validityWindowIsInclusiveAndEndsTheNextDay() {
        grant(admin.id(), tennis, "ACTIVE", TODAY, TODAY);
        grant(admin.id(), badminton, "ACTIVE", null, TODAY.minusDays(1));
        grant(admin.id(), pool, "ACTIVE", TODAY.plusDays(1), null);

        assertAllowed(tennis);
        assertScopeDenied(badminton);
        assertScopeDenied(pool);

        clock.setLocal(MutableClock.START.plusDays(1));
        assertScopeDenied(tennis);
        assertAllowed(pool);
    }

    @Test
    void effectiveVenueIdsAreAscendingAndOnlyCurrentlyValid() {
        grant(admin.id(), pool, "ACTIVE", null, null);
        grant(admin.id(), tennis, "ACTIVE", TODAY.minusDays(3), TODAY.plusDays(3));
        grant(admin.id(), badminton, "REVOKED", null, null);
        long otherAdmin = user("admin_other", Role.VENUE_ADMIN);
        grant(otherAdmin, badminton, "ACTIVE", null, null);

        assertThat(guard.effectiveVenueIds(admin.id())).containsExactly(tennis, pool);

        clock.setLocal(MutableClock.START.plusDays(4));
        assertThat(guard.effectiveVenueIds(admin.id())).containsExactly(pool);
    }
}
