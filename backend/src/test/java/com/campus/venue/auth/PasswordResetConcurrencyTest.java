package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.ConcurrentRequests;
import com.campus.venue.support.LockHolder;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** SEC-2b 裁决第 1 节第 3 条、第 2 节“并发”：同一用户名的并发尝试由咨询锁串行，记录的失败数不超过上限。 */
class PasswordResetConcurrencyTest extends PasswordResetApiTestBase {

    private static final int REQUESTS = 10;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("同一用户名并发 10 次错误尝试：恰 7 次 RESET_INFO_MISMATCH（剩余 6…0 各一次）、3 次 LOCKED，库中恰 7 条失败")
    void concurrentFailuresNeverExceedTheLimit() throws Exception {
        student("zhangsan");
        List<Callable<MvcResult>> tasks = new ArrayList<>();
        for (int i = 0; i < REQUESTS; i++) {
            tasks.add(() -> reset(wrong("zhangsan")));
        }

        List<MvcResult> results = ConcurrentRequests.runTogether(tasks);

        List<Integer> remaining = new ArrayList<>();
        int locked = 0;
        for (MvcResult result : results) {
            String code = json(result).get("code").asText();
            if (ErrorCode.PASSWORD_RESET_LOCKED.name().equals(code)) {
                assertError(result, ErrorCode.PASSWORD_RESET_LOCKED);
                locked++;
            } else {
                remaining.add(assertError(result, ErrorCode.RESET_INFO_MISMATCH)
                        .get("details").get("remainingAttempts").asInt());
            }
        }
        assertThat(remaining).containsExactlyInAnyOrder(6, 5, 4, 3, 2, 1, 0);
        assertThat(locked).isEqualTo(REQUESTS - 7);
        assertThat(attempts("zhangsan", false)).isEqualTo(7);
    }

    @Test
    @DisplayName("确定性：持锁方持有该用户名的咨询锁时，请求在等锁；放行后才计数（去掉咨询锁则本测试失败）")
    void requestWaitsForTheUsernameLock() throws Exception {
        student("zhangsan");
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try (LockHolder holder = LockHolder.open(dataSource, jdbc)) {
            holder.execute("select pg_advisory_xact_lock(103, hashtext(?))", "zhangsan");
            Future<MvcResult> pending = pool.submit(() -> reset(wrong("zhangsan")));

            holder.awaitBlocked(pending);
            assertThat(allAttempts()).isZero();
            holder.commit();

            MvcResult result = pending.get(30, TimeUnit.SECONDS);
            assertThat(assertError(result, ErrorCode.RESET_INFO_MISMATCH)
                    .get("details").get("remainingAttempts").asInt()).isEqualTo(6);
            assertThat(attempts("zhangsan", false)).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }
}
