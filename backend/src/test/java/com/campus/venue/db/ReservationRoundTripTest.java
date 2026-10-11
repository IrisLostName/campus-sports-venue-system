package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.announcement.domain.Announcement;
import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.reservation.domain.Reservation;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.reservation.domain.UsageRecord;
import com.campus.venue.support.AbstractEntityTest;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** 实体往返测试（二）：reservation、usage_record、announcement。 */
class ReservationRoundTripTest extends AbstractEntityTest {

    private Reservation newReservation(AppUser user, Resource resource) {
        Reservation reservation = new Reservation();
        reservation.setUserId(user.getId());
        reservation.setResourceId(resource.getId());
        reservation.setServiceDate(LocalDate.of(2026, 10, 12));
        reservation.setStartTime(LocalTime.of(9, 0));
        reservation.setEndTime(LocalTime.of(10, 30));
        reservation.setCreatedAt(NOW);
        reservation.setUpdatedAt(NOW);
        return reservation;
    }

    @Test
    void reservationRoundTrip() {
        AppUser user = newUser("res_user", Role.USER);
        AppUser admin = newUser("res_admin", Role.SYS_ADMIN);
        Resource resource = newResource(newVenue("预约馆"), "预约场1");
        Reservation reservation = newReservation(user, resource);
        reservation.setStatus(ReservationStatus.ADMIN_CANCELLED);
        reservation.setPurpose("周末训练");
        reservation.setCancelledAt(NOW.plusHours(1));
        reservation.setCancelledBy(admin.getId());
        reservation.setCancelReason("用户取消原因");
        reservation.setAdminNote("场地维修");
        persist(reservation);

        Reservation loaded = reload(Reservation.class, reservation.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(reservation);
        Long id = reservation.getId();
        assertThat(text("select status from reservation where id = ?", id)).isEqualTo("ADMIN_CANCELLED");
        assertThat(text("select service_date::text from reservation where id = ?", id)).isEqualTo("2026-10-12");
        assertThat(text("select start_time::text from reservation where id = ?", id)).isEqualTo("09:00:00");
        assertThat(text("select end_time::text from reservation where id = ?", id)).isEqualTo("10:30:00");
        assertThat(text("select cancelled_at::text from reservation where id = ?", id))
                .isEqualTo("2026-10-12 09:30:15");
    }

    @Test
    void defaultStatusIsConfirmedAndStoredAsText() {
        Reservation reservation = newReservation(newUser("def_user", Role.USER),
                newResource(newVenue("默认馆"), "默认场1"));
        persist(reservation);

        assertThat(reload(Reservation.class, reservation.getId()).getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
        assertThat(text("select status from reservation where id = ?", reservation.getId())).isEqualTo("CONFIRMED");
    }

    @Test
    void usageRecordRoundTrip() {
        Reservation reservation = persist(newReservation(newUser("use_user", Role.USER),
                newResource(newVenue("使用馆"), "使用场1")));
        UsageRecord record = new UsageRecord();
        record.setReservationId(reservation.getId());
        record.setCheckInAt(NOW);
        record.setCheckOutAt(NOW.plusMinutes(80));
        persist(record);

        UsageRecord loaded = reload(UsageRecord.class, record.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(record);
        assertThat(text("select check_in_at::text from usage_record where id = ?", record.getId()))
                .isEqualTo("2026-10-12 08:30:15");
        assertThat(text("select check_out_at::text from usage_record where id = ?", record.getId()))
                .isEqualTo("2026-10-12 09:50:15");
    }

    @Test
    void usageRecordWithoutCheckOutKeepsItNull() {
        Reservation reservation = persist(newReservation(newUser("use_user2", Role.USER),
                newResource(newVenue("使用馆2"), "使用场2")));
        UsageRecord record = new UsageRecord();
        record.setReservationId(reservation.getId());
        record.setCheckInAt(NOW);
        persist(record);

        assertThat(reload(UsageRecord.class, record.getId()).getCheckOutAt()).isNull();
    }

    @Test
    void venueAnnouncementRoundTrip() {
        AppUser publisher = newUser("ann_admin", Role.VENUE_ADMIN);
        Venue venue = newVenue("公告馆");
        Announcement announcement = new Announcement();
        announcement.setScope(AnnouncementScope.VENUE);
        announcement.setVenueId(venue.getId());
        announcement.setTitle("场地保养");
        announcement.setContent("场地保养：每周一 08:00–09:30 视情况关闭 1 片球场");
        announcement.setStatus(AnnouncementStatus.ARCHIVED);
        announcement.setPublishedBy(publisher.getId());
        announcement.setPublishedAt(NOW);
        announcement.setExpiresAt(NOW.plusDays(7));
        persist(announcement);

        Announcement loaded = reload(Announcement.class, announcement.getId());

        assertThat(loaded).usingRecursiveComparison().isEqualTo(announcement);
        assertThat(text("select scope from announcement where id = ?", announcement.getId())).isEqualTo("VENUE");
        assertThat(text("select status from announcement where id = ?", announcement.getId()))
                .isEqualTo("ARCHIVED");
        assertThat(text("select expires_at::text from announcement where id = ?", announcement.getId()))
                .isEqualTo("2026-10-19 08:30:15");
    }

    @Test
    void systemAnnouncementKeepsVenueNull() {
        AppUser publisher = newUser("ann_sys", Role.SYS_ADMIN);
        Announcement announcement = new Announcement();
        announcement.setScope(AnnouncementScope.SYSTEM);
        announcement.setTitle("欢迎");
        announcement.setContent("欢迎");
        announcement.setPublishedBy(publisher.getId());
        announcement.setPublishedAt(NOW);
        persist(announcement);

        Announcement loaded = reload(Announcement.class, announcement.getId());

        assertThat(loaded.getVenueId()).isNull();
        assertThat(loaded.getExpiresAt()).isNull();
        assertThat(loaded.getStatus()).isEqualTo(AnnouncementStatus.ACTIVE);
    }
}
