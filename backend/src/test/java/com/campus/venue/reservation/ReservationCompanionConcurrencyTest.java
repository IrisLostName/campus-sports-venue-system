package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.user.domain.Role;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * P2-2b：并发抢同一时段且各带同行人。部分唯一索引挡住后到的预约插入（SLOT_TAKEN），名单写在预约插入之后、同一事务内，
 * 所以失败一方的名单一行也不残留，库中只有胜出预约的名单。
 */
@DisplayName("P2-2b 并发预约与同行人名单")
class ReservationCompanionConcurrencyTest extends ReservationApiTestBase {

    private static final int USERS = 6;

    @Test
    @DisplayName("6 个用户各带 2 位同行人并发抢同一时段：恰好一个成功，只有胜出预约的 2 行名单")
    void onlyTheWinnersCompanionsAreStored() throws Exception {
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (int i = 0; i < USERS; i++) {
            long owner = user("owner" + i, Role.USER);
            long first = user("first" + i, Role.USER);
            long second = user("second" + i, Role.USER);
            String json = "{\"resourceId\":" + court1 + ",\"serviceDate\":\"" + TOMORROW
                    + "\",\"startTime\":\"09:30\",\"companionUserIds\":[" + first + "," + second + "]}";
            tasks.add(() -> create(userBearer(owner), json));
        }

        List<MvcResult> results = ConcurrentRequests.runTogether(tasks);

        List<Integer> statuses = results.stream().map(result -> result.getResponse().getStatus()).toList();
        assertThat(statuses).filteredOn(status -> status == 201).hasSize(1);
        assertThat(statuses).filteredOn(status -> status == 409).hasSize(USERS - 1);
        long winner = jdbc.queryForObject("select id from reservation", Long.class);
        assertThat(jdbc.queryForList("select reservation_id from reservation_companion", Long.class))
                .hasSize(2).containsOnly(winner);
    }
}
