package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.user.domain.Role;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * P2-2b：V102__reservation_companion.sql 的约束（docs/13 第 3.6a 节）：主键 (reservation_id, user_id)、
 * 同一预约内 position 唯一、position 只能为 1–6、两个外键（不级联，删除被引用的预约被拒绝）。
 */
@DisplayName("P2-2b 同行人名单迁移")
class ReservationCompanionMigrationTest extends AbstractApiTest {

    private static final String INSERT =
            "insert into reservation_companion (reservation_id, user_id, position) values (?, ?, ?)";

    private long reservation;
    private long lisi;
    private long wangwu;

    @BeforeEach
    void seed() {
        VenueFixtures fixtures = new VenueFixtures(jdbc);
        long zhangsan = user("zhangsan", Role.USER);
        lisi = user("lisi", Role.USER);
        wangwu = user("wangwu", Role.USER);
        long venue = fixtures.bookableVenue("网球馆");
        long court = fixtures.resource(venue, "网球场1", 1, "OPEN");
        LocalDate tomorrow = MutableClock.START.toLocalDate().plusDays(1);
        reservation = fixtures.reservation(zhangsan, court, tomorrow, "09:30", "CONFIRMED");
    }

    private void rejected(Runnable insert, String constraint) {
        assertThatThrownBy(insert::run).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining(constraint);
    }

    @Test
    @DisplayName("position 1 与 6 可写入")
    void positionsOneAndSixAreAccepted() {
        jdbc.update(INSERT, reservation, lisi, 1);
        jdbc.update(INSERT, reservation, wangwu, 6);

        assertThat(jdbc.queryForList("select position from reservation_companion where reservation_id = ?"
                + " order by position", Integer.class, reservation)).containsExactly(1, 6);
    }

    @Test
    @DisplayName("主键 pk_reservation_companion：同一预约不能重复列入同一用户")
    void sameUserTwiceViolatesThePrimaryKey() {
        jdbc.update(INSERT, reservation, lisi, 1);

        rejected(() -> jdbc.update(INSERT, reservation, lisi, 2), "pk_reservation_companion");
    }

    @Test
    @DisplayName("唯一约束 uq_reservation_companion_position：同一预约内 position 不能重复")
    void samePositionTwiceViolatesTheUniqueConstraint() {
        jdbc.update(INSERT, reservation, lisi, 1);

        rejected(() -> jdbc.update(INSERT, reservation, wangwu, 1), "uq_reservation_companion_position");
    }

    @Test
    @DisplayName("检查约束 ck_reservation_companion_position：position 0 与 7 被拒绝")
    void positionsOutsideOneToSixViolateTheCheck() {
        rejected(() -> jdbc.update(INSERT, reservation, lisi, 0), "ck_reservation_companion_position");
        rejected(() -> jdbc.update(INSERT, reservation, lisi, 7), "ck_reservation_companion_position");
    }

    @Test
    @DisplayName("外键：不存在的预约或用户被拒绝；被引用的预约不能删除（不级联）")
    void foreignKeysRejectMissingRowsAndDoNotCascade() {
        rejected(() -> jdbc.update(INSERT, 999_999L, lisi, 1), "fk_reservation_companion_reservation");
        rejected(() -> jdbc.update(INSERT, reservation, 999_999L, 1), "fk_reservation_companion_user");

        jdbc.update(INSERT, reservation, lisi, 1);
        rejected(() -> jdbc.update("delete from reservation where id = ?", reservation),
                "fk_reservation_companion_reservation");
        rejected(() -> jdbc.update("delete from app_user where id = ?", lisi), "fk_reservation_companion_user");
    }
}
