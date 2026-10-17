package com.campus.venue.stats;

import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.VenueFixtures;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.repository.VenueRepository;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * BE-7 统计测试的公共部分：测试数据直接写测试库。fixtures 的预约 created_at 取数据库 now()，
 * 所以凡是 K1 相关的预约都用 reservation(…, createdAt) 显式设置创建时刻。
 */
public abstract class StatsTestBase extends AbstractApiTest {

    /** 2026-10-12，周一；MutableClock 起点 08:30:15。 */
    protected static final LocalDate TODAY = MutableClock.START.toLocalDate();

    protected VenueFixtures fixtures;

    @Autowired
    private VenueRepository venueRepository;

    @BeforeEach
    void createFixtures() {
        fixtures = new VenueFixtures(jdbc);
    }

    /** 指定创建时刻的预约。 */
    protected long reservation(long userId, long resourceId, LocalDate date, String start, String status,
            LocalDateTime createdAt) {
        long id = fixtures.reservation(userId, resourceId, date, start, status);
        jdbc.update("update reservation set created_at = ? where id = ?", Timestamp.valueOf(createdAt), id);
        return id;
    }

    /** 今天 08:00 创建的预约。 */
    protected long reservation(long userId, long resourceId, LocalDate date, String start, String status) {
        return reservation(userId, resourceId, date, start, status, TODAY.atTime(8, 0));
    }

    /** 按 id 升序取场馆实体（统计组件的入参）。 */
    protected List<Venue> venues(Long... ids) {
        return venueRepository.findAllByIdInOrderByIdAsc(Arrays.asList(ids));
    }
}
