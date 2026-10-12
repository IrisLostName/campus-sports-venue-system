package com.campus.venue.support;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.springframework.jdbc.core.JdbcTemplate;

/** 场馆、场地、开放规则、预约、使用记录、授权的测试数据：直接写库（BE-3 之前没有创建预约的接口，T5）。 */
public final class VenueFixtures {

    private final JdbcTemplate jdbc;

    public VenueFixtures(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long venue(String name, boolean userBookingEnabled, String operationalStatus) {
        return jdbc.queryForObject("insert into venue (name, venue_type, user_booking_enabled, operational_status)"
                + " values (?, 'TENNIS', ?, ?) returning id", Long.class, name, userBookingEnabled, operationalStatus);
    }

    public long bookableVenue(String name) {
        return venue(name, true, "OPEN");
    }

    public long resource(long venueId, String name, int sortOrder, String operationalStatus) {
        return jdbc.queryForObject("insert into resource (venue_id, name, sort_order, operational_status)"
                + " values (?, ?, ?, ?) returning id", Long.class, venueId, name, sortOrder, operationalStatus);
    }

    public long weekly(long venueId, int weekday, String open, String close) {
        return jdbc.queryForObject("insert into availability_rule (venue_id, rule_type, weekday, open_time, close_time)"
                + " values (?, 'WEEKLY', ?, ?, ?) returning id", Long.class, venueId, weekday,
                LocalTime.parse(open), LocalTime.parse(close));
    }

    /** 每天（周一至周日）同一个窗口。 */
    public void weeklyEveryDay(long venueId, String open, String close) {
        for (int weekday = 1; weekday <= 7; weekday++) {
            weekly(venueId, weekday, open, close);
        }
    }

    public long closure(long venueId, Long resourceId, LocalDate start, LocalDate end) {
        return jdbc.queryForObject("insert into availability_rule (venue_id, rule_type, start_date, end_date,"
                + " resource_id, reason) values (?, 'CLOSURE', ?, ?, ?, '保养') returning id", Long.class,
                venueId, start, end, resourceId);
    }

    public void deactivateRule(long ruleId) {
        jdbc.update("update availability_rule set status = 'INACTIVE' where id = ?", ruleId);
    }

    public long reservation(long userId, long resourceId, LocalDate date, String start, String status) {
        LocalTime startTime = LocalTime.parse(start);
        return jdbc.queryForObject("insert into reservation (user_id, resource_id, service_date, start_time, end_time,"
                + " status) values (?, ?, ?, ?, ?, ?) returning id", Long.class, userId, resourceId, date,
                startTime, startTime.plusMinutes(90), status);
    }

    public void usage(long reservationId, LocalDateTime checkIn, LocalDateTime checkOut) {
        jdbc.update("insert into usage_record (reservation_id, check_in_at, check_out_at) values (?, ?, ?)",
                reservationId, Timestamp.valueOf(checkIn), checkOut == null ? null : Timestamp.valueOf(checkOut));
    }

    public void grant(long adminId, long venueId, String status, LocalDate from, LocalDate to, long grantedBy) {
        jdbc.update("insert into admin_venue_scope (admin_id, venue_id, status, valid_from, valid_to, granted_by)"
                + " values (?, ?, ?, ?, ?, ?)", adminId, venueId, status, from, to, grantedBy);
    }

    public void grant(long adminId, long venueId, long grantedBy) {
        grant(adminId, venueId, "ACTIVE", null, null, grantedBy);
    }
}
