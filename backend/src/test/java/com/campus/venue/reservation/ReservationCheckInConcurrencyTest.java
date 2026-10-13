package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.test.web.servlet.MvcResult;

/**
 * ACC-M3-05 并发签到（BE-4 I3、T3）：真实线程 + CountDownLatch + 真实 PostgreSQL，经完整的 HTTP 栈同时提交。
 * 预约行锁使第二个请求看到第一个的使用记录；uq_usage_record_reservation 的 23505 兜底转换为 ALREADY_CHECKED_IN。
 * 重复多次以提高真正交错的概率。
 */
@DisplayName("ACC-M3-05 并发签到")
class ReservationCheckInConcurrencyTest extends UsageApiTestBase {

    private static final int REQUESTS = 2;

    /** 所有请求就绪后同时放行，返回每个请求的“状态码 + 错误码”。 */
    private List<String> runTogether(Callable<MvcResult> task) throws Exception {
        CountDownLatch ready = new CountDownLatch(REQUESTS);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(REQUESTS);
        try {
            List<Future<MvcResult>> futures = new ArrayList<>();
            for (int i = 0; i < REQUESTS; i++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    return task.call();
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<String> outcomes = new ArrayList<>();
            for (Future<MvcResult> future : futures) {
                MvcResult result = future.get(60, TimeUnit.SECONDS);
                int status = result.getResponse().getStatus();
                outcomes.add(status == 200 ? "200" : status + " " + json(result).get("code").asText());
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    @RepeatedTest(10)
    @DisplayName("ACC-M3-05 同一预约两个签到请求同时提交：恰好 1 个 200、1 个 ALREADY_CHECKED_IN，使用记录 1 条")
    void twoSimultaneousCheckInsYieldExactlyOneUsageRecord() throws Exception {
        long id = todaySlot(zhangsan);
        clock.setLocal(today(9, 20, 0));
        String authorization = userBearer(zhangsan);

        List<String> outcomes = runTogether(() -> checkIn(authorization, id));

        assertThat(outcomes).containsExactlyInAnyOrder("200", "409 ALREADY_CHECKED_IN");
        assertThat(usageCount(id)).isEqualTo(1);
    }
}
