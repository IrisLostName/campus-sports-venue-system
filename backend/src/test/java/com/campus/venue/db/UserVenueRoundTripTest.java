package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.support.AbstractEntityTest;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.domain.UserType;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.ResourceType;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.domain.VenueType;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** 实体往返测试（一）：app_user、venue、resource、availability_rule。 */
class UserVenueRoundTripTest extends AbstractEntityTest {

    @Test
    void appUserRoundTrip() {
        AppUser user = new AppUser();
        user.setUsername("round_user");
        user.setPasswordHash("$2b$10$hash");
        user.setDisplayName("往返用户");
        user.setRole(Role.VENUE_ADMIN);
        user.setUserType(UserType.TEACHER);
        user.setPhone("13800000000");
        user.setStatus(AccountStatus.DISABLED);
        user.setCreatedAt(NOW);
        user.setUpdatedAt(NOW.plusMinutes(5));
        persist(user);

        AppUser loaded = reload(AppUser.class, user.getId());

        assertThat(user.getId()).isNotNull();
        assertThat(loaded).usingRecursiveComparison().isEqualTo(user);
        assertThat(text("select role from app_user where id = ?", user.getId())).isEqualTo("VENUE_ADMIN");
        assertThat(text("select user_type from app_user where id = ?", user.getId())).isEqualTo("TEACHER");
        assertThat(text("select status from app_user where id = ?", user.getId())).isEqualTo("DISABLED");
        assertThat(text("select created_at::text from app_user where id = ?", user.getId()))
                .isEqualTo("2026-10-12 08:30:15");
        assertThat(text("select updated_at::text from app_user where id = ?", user.getId()))
                .isEqualTo("2026-10-12 08:35:15");
    }

    @Test
    void venueRoundTrip() {
        Venue venue = new Venue();
        venue.setName("往返游泳馆");
        venue.setVenueType(VenueType.SWIMMING);
        venue.setLocation("东区");
        venue.setDescription("往返简介");
        venue.setOperationalStatus(VenueStatus.CLOSED);
        venue.setUserBookingEnabled(true);
        venue.setCreatedAt(NOW);
        venue.setUpdatedAt(NOW);
        persist(venue);

        Venue loaded = reload(Venue.class, venue.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(venue);
        assertThat(text("select venue_type from venue where id = ?", venue.getId())).isEqualTo("SWIMMING");
        assertThat(text("select operational_status from venue where id = ?", venue.getId())).isEqualTo("CLOSED");
        assertThat(text("select user_booking_enabled::text from venue where id = ?", venue.getId()))
                .isEqualTo("true");
    }

    @Test
    void resourceRoundTrip() {
        Venue venue = newVenue("往返馆");
        Resource resource = new Resource();
        resource.setVenueId(venue.getId());
        resource.setName("泳道3");
        resource.setResourceType(ResourceType.LANE);
        resource.setSortOrder(3);
        resource.setOperationalStatus(ResourceStatus.MAINTENANCE);
        resource.setCreatedAt(NOW);
        resource.setUpdatedAt(NOW);
        persist(resource);

        Resource loaded = reload(Resource.class, resource.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(resource);
        assertThat(text("select resource_type from resource where id = ?", resource.getId())).isEqualTo("LANE");
        assertThat(text("select operational_status from resource where id = ?", resource.getId()))
                .isEqualTo("MAINTENANCE");
        assertThat(text("select sort_order::text from resource where id = ?", resource.getId())).isEqualTo("3");
    }

    @Test
    void weeklyAvailabilityRuleRoundTrip() {
        Venue venue = newVenue("规则馆");
        AvailabilityRule rule = new AvailabilityRule();
        rule.setVenueId(venue.getId());
        rule.setRuleType(AvailabilityRuleType.WEEKLY);
        rule.setWeekday((short) 3);
        rule.setOpenTime(LocalTime.of(8, 0));
        rule.setCloseTime(LocalTime.of(20, 0));
        rule.setCreatedBy(newUser("rule_admin", Role.SYS_ADMIN).getId());
        rule.setCreatedAt(NOW);
        persist(rule);

        AvailabilityRule loaded = reload(AvailabilityRule.class, rule.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(rule);
        assertThat(loaded.getStatus()).isEqualTo(AvailabilityRuleStatus.ACTIVE);
        assertThat(text("select rule_type from availability_rule where id = ?", rule.getId())).isEqualTo("WEEKLY");
        assertThat(text("select weekday::text from availability_rule where id = ?", rule.getId())).isEqualTo("3");
        assertThat(text("select open_time::text from availability_rule where id = ?", rule.getId()))
                .isEqualTo("08:00:00");
        assertThat(text("select close_time::text from availability_rule where id = ?", rule.getId()))
                .isEqualTo("20:00:00");
    }

    @Test
    void closureAvailabilityRuleRoundTrip() {
        Venue venue = newVenue("关闭馆");
        Resource resource = newResource(venue, "关闭场1");
        AvailabilityRule rule = new AvailabilityRule();
        rule.setVenueId(venue.getId());
        rule.setRuleType(AvailabilityRuleType.CLOSURE);
        rule.setStartDate(LocalDate.of(2026, 10, 20));
        rule.setEndDate(LocalDate.of(2026, 10, 22));
        rule.setResourceId(resource.getId());
        rule.setReason("场地保养");
        rule.setStatus(AvailabilityRuleStatus.INACTIVE);
        rule.setCreatedAt(NOW);
        persist(rule);

        AvailabilityRule loaded = reload(AvailabilityRule.class, rule.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(rule);
        assertThat(text("select rule_type from availability_rule where id = ?", rule.getId())).isEqualTo("CLOSURE");
        assertThat(text("select status from availability_rule where id = ?", rule.getId())).isEqualTo("INACTIVE");
        assertThat(text("select start_date::text from availability_rule where id = ?", rule.getId()))
                .isEqualTo("2026-10-20");
        assertThat(text("select end_date::text from availability_rule where id = ?", rule.getId()))
                .isEqualTo("2026-10-22");
    }
}
