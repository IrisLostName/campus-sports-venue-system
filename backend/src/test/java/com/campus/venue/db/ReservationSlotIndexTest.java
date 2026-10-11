package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.support.DatabaseCleaner;
import com.campus.venue.support.IntegrationTest;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 迁移/索引测试：uq_reservation_active_slot 存在、唯一、带 status 条件；
 * 在库层验证同一场地同一日期同一时段的第二条有效预约触发 23505，已取消的不占用。
 */
@IntegrationTest
class ReservationSlotIndexTest {

    private static final String INDEX = "uq_reservation_active_slot";
    private static final LocalDate DAY = LocalDate.of(2026, 10, 12);
    private static final LocalTime NINE = LocalTime.of(9, 0);

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    private long userId;
    private long resourceId;

    @BeforeEach
    void prepareReferenceRows() {
        DatabaseCleaner.truncateAll(dataSource);
        userId = jdbc.queryForObject("insert into app_user (username, password_hash, display_name, role) "
                + "values ('slot_user', 'x', '测试用户', 'USER') returning id", Long.class);
        long venueId = jdbc.queryForObject(
                "insert into venue (name, venue_type) values ('测试馆', 'TENNIS') returning id", Long.class);
        resourceId = insertResource(venueId, "测试场1");
    }

    private long insertResource(long venueId, String name) {
        return jdbc.queryForObject("insert into resource (venue_id, name) values (?, ?) returning id",
                Long.class, venueId, name);
    }

    private long insertReservation(long resource, LocalDate date, LocalTime start, String status) {
        return jdbc.queryForObject("insert into reservation (user_id, resource_id, service_date, start_time, "
                + "end_time, status) values (?, ?, ?, ?, ?, ?) returning id", Long.class,
                userId, resource, date, start, start.plusMinutes(90), status);
    }

    @Test
    void indexExistsIsUniqueAndHasAStatusPredicate() {
        String definition = jdbc.queryForObject(
                "select indexdef from pg_indexes where indexname = ?", String.class, INDEX);
        Boolean unique = jdbc.queryForObject("select i.indisunique from pg_index i "
                + "join pg_class c on c.oid = i.indexrelid where c.relname = ?", Boolean.class, INDEX);
        Boolean partial = jdbc.queryForObject("select i.indpred is not null from pg_index i "
                + "join pg_class c on c.oid = i.indexrelid where c.relname = ?", Boolean.class, INDEX);

        assertThat(unique).isTrue();
        assertThat(partial).isTrue();
        assertThat(definition).contains("CREATE UNIQUE INDEX", "ON public.reservation",
                "(resource_id, service_date, start_time)", "WHERE", "status", "'CANCELLED'", "'ADMIN_CANCELLED'");
    }

    @ParameterizedTest
    @ValueSource(strings = {"CONFIRMED", "COMPLETED", "NO_SHOW"})
    void secondActiveReservationForTheSameSlotViolatesTheUniqueIndex(String firstStatus) {
        insertReservation(resourceId, DAY, NINE, firstStatus);

        assertThatThrownBy(() -> insertReservation(resourceId, DAY, NINE, "CONFIRMED"))
                .isInstanceOf(DuplicateKeyException.class)
                .satisfies(error -> {
                    Throwable root = NestedExceptionUtils.getRootCause(error);
                    assertThat(root).isInstanceOf(SQLException.class);
                    assertThat(((SQLException) root).getSQLState()).isEqualTo("23505");
                    assertThat(root.getMessage()).contains(INDEX);
                });
        assertThat(count(resourceId)).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"CANCELLED", "ADMIN_CANCELLED"})
    void cancelledReservationsDoNotOccupyTheSlot(String cancelledStatus) {
        insertReservation(resourceId, DAY, NINE, cancelledStatus);
        insertReservation(resourceId, DAY, NINE, cancelledStatus);

        assertThatCode(() -> insertReservation(resourceId, DAY, NINE, "CONFIRMED")).doesNotThrowAnyException();
        assertThat(count(resourceId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select count(*) from reservation where status = 'CONFIRMED'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void cancellingAnActiveReservationReleasesTheSlot() {
        long first = insertReservation(resourceId, DAY, NINE, "CONFIRMED");
        jdbc.update("update reservation set status = 'CANCELLED' where id = ?", first);

        assertThatCode(() -> insertReservation(resourceId, DAY, NINE, "CONFIRMED")).doesNotThrowAnyException();
    }

    @Test
    void differentResourceDateOrStartTimeDoNotConflict() {
        long otherResource = insertResource(
                jdbc.queryForObject("select venue_id from resource where id = ?", Long.class, resourceId), "测试场2");
        insertReservation(resourceId, DAY, NINE, "CONFIRMED");

        assertThatCode(() -> {
            insertReservation(otherResource, DAY, NINE, "CONFIRMED");
            insertReservation(resourceId, DAY.plusDays(1), NINE, "CONFIRMED");
            insertReservation(resourceId, DAY, LocalTime.of(10, 30), "CONFIRMED");
        }).doesNotThrowAnyException();
        assertThat(jdbc.queryForObject("select count(*) from reservation", Integer.class)).isEqualTo(4);
    }

    @Test
    void reactivatingACancelledReservationIntoAnOccupiedSlotIsRejected() {
        long cancelled = insertReservation(resourceId, DAY, NINE, "CANCELLED");
        insertReservation(resourceId, DAY, NINE, "CONFIRMED");

        assertThatThrownBy(() -> jdbc.update("update reservation set status = 'CONFIRMED' where id = ?", cancelled))
                .isInstanceOf(DuplicateKeyException.class);
    }

    private int count(long resource) {
        return jdbc.queryForObject("select count(*) from reservation where resource_id = ?", Integer.class, resource);
    }
}
