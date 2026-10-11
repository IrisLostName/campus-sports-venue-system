package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.audit.domain.AdminVenueScope;
import com.campus.venue.availability.domain.AvailabilityRule;
import com.campus.venue.repair.domain.RepairReport;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.support.AbstractEntityTest;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import org.junit.jupiter.api.Test;

/**
 * 数据库 DEFAULT 与实体字段初始值保持一致：行只靠数据库默认值插入，读出的实体应等于新建实体的默认值。
 */
class EntityDefaultsTest extends AbstractEntityTest {

    private long insertUser() {
        return jdbc.queryForObject("insert into app_user (username, password_hash, display_name, role) "
                + "values ('def_u', 'x', '默认', 'USER') returning id", Long.class);
    }

    private long insertVenue() {
        return jdbc.queryForObject(
                "insert into venue (name, venue_type) values ('默认馆', 'OTHER') returning id", Long.class);
    }

    @Test
    void userAndVenueDefaults() {
        AppUser loadedUser = reload(AppUser.class, insertUser());
        Venue loadedVenue = reload(Venue.class, insertVenue());

        assertThat(loadedUser.getUserType()).isEqualTo(new AppUser().getUserType());
        assertThat(loadedUser.getStatus()).isEqualTo(new AppUser().getStatus());
        assertThat(loadedVenue.getOperationalStatus()).isEqualTo(new Venue().getOperationalStatus());
        assertThat(loadedVenue.isUserBookingEnabled()).isEqualTo(new Venue().isUserBookingEnabled());
    }

    @Test
    void resourceAndRuleDefaults() {
        long venueId = insertVenue();
        long resourceId = jdbc.queryForObject(
                "insert into resource (venue_id, name) values (?, '默认场') returning id", Long.class, venueId);
        long ruleId = jdbc.queryForObject("insert into availability_rule (venue_id, rule_type, weekday, open_time, "
                + "close_time) values (?, 'WEEKLY', 1, '08:00', '09:30') returning id", Long.class, venueId);

        Resource resource = reload(Resource.class, resourceId);
        AvailabilityRule rule = reload(AvailabilityRule.class, ruleId);

        assertThat(resource.getResourceType()).isEqualTo(new Resource().getResourceType());
        assertThat(resource.getSortOrder()).isEqualTo(new Resource().getSortOrder());
        assertThat(resource.getOperationalStatus()).isEqualTo(new Resource().getOperationalStatus());
        assertThat(rule.getStatus()).isEqualTo(new AvailabilityRule().getStatus());
    }

    @Test
    void reservationAnnouncementRepairAndScopeDefaults() {
        long userId = insertUser();
        long venueId = insertVenue();
        long resourceId = jdbc.queryForObject(
                "insert into resource (venue_id, name) values (?, '默认场') returning id", Long.class, venueId);
        long reservationId = jdbc.queryForObject("insert into reservation (user_id, resource_id, service_date, "
                + "start_time, end_time) values (?, ?, '2026-10-12', '09:00', '10:30') returning id",
                Long.class, userId, resourceId);
        long announcementId = jdbc.queryForObject("insert into announcement (scope, title, content, published_by) "
                + "values ('SYSTEM', 't', 'c', ?) returning id", Long.class, userId);
        long repairId = jdbc.queryForObject("insert into repair_report (venue_id, reporter_id, description) "
                + "values (?, ?, 'd') returning id", Long.class, venueId, userId);
        long scopeId = jdbc.queryForObject("insert into admin_venue_scope (admin_id, venue_id, granted_by) "
                + "values (?, ?, ?) returning id", Long.class, userId, venueId, userId);

        assertThat(reload(Reservation.class, reservationId).getStatus()).isEqualTo(new Reservation().getStatus());
        assertThat(reload(Announcement.class, announcementId).getStatus()).isEqualTo(new Announcement().getStatus());
        assertThat(reload(RepairReport.class, repairId).getStatus()).isEqualTo(new RepairReport().getStatus());
        assertThat(reload(AdminVenueScope.class, scopeId).getStatus()).isEqualTo(new AdminVenueScope().getStatus());
    }
}
