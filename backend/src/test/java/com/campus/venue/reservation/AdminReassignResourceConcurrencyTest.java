package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.user.domain.Role;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-5 A3、T3：并发改派到同一时段。真实线程 + CountDownLatch + 真实 PostgreSQL，经完整的 HTTP 栈同时提交；
 * 各请求只锁定各自的预约行，前置检查可能同时通过，最终由部分唯一索引挡住，冲突转换为 SLOT_TAKEN。
 */
class AdminReassignResourceConcurrencyTest extends AdminReservationApiTestBase {

    private static final int RESERVATIONS = 5;

    private static String outcome(MvcResult result) throws Exception {
        int status = result.getResponse().getStatus();
        return status == 200 ? "200" : status + " " + result.getResponse().getContentAsString().replaceAll(
                ".*\"code\":\"([A-Z_]+)\".*", "$1");
    }

    @Test
    @DisplayName("5 个不同预约同时改派到同一空闲时段：恰好 1 个 200、4 个 SLOT_TAKEN，目标时段有效预约恰 1 条，日志 1 行")
    void concurrentReassignmentsToOneSlot() throws Exception {
        long[] courts = {court1, court2, court3};
        List<Long> sources = new ArrayList<>();
        for (int i = 0; i < RESERVATIONS; i++) {
            long owner = user("owner" + i, Role.USER);
            sources.add(reservation(owner, courts[i % 3], TOMORROW, i < 3 ? "08:00" : "09:30"));
        }
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (long id : sources) {
            tasks.add(() -> asSys(HttpMethod.POST, REASSIGN_RESOURCE, body("resourceId", court4,
                    "serviceDate", TOMORROW.toString(), "startTime", "14:00", "reason", "集中安排"), id));
        }

        List<String> outcomes = new ArrayList<>();
        for (MvcResult result : ConcurrentRequests.runTogether(tasks)) {
            outcomes.add(outcome(result));
        }

        assertThat(outcomes).filteredOn("200"::equals).hasSize(1);
        assertThat(outcomes).filteredOn(outcome -> !"200".equals(outcome)).hasSize(RESERVATIONS - 1)
                .containsOnly("409 SLOT_TAKEN");
        assertThat(jdbc.queryForObject("select count(*) from reservation where resource_id = ? and service_date = ?"
                + " and start_time = '14:00' and status not in ('CANCELLED', 'ADMIN_CANCELLED')", Integer.class,
                court4, TOMORROW)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reservation where resource_id <> ?", Integer.class,
                court4)).isEqualTo(RESERVATIONS - 1);
        assertThat(logCount()).isEqualTo(1);
    }
}
