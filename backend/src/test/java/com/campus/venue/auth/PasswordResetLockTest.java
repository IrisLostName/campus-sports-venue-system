package com.campus.venue.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.MutableClock;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * SEC-2b 裁决第 3 条与第 2 节“锁定”：24 小时内、最近一次成功之后的失败达 7 次 → PASSWORD_RESET_LOCKED，
 * unlocksAt = 最早一次计入的失败 + 24 小时；锁定的请求不记录、不核对；到 unlocksAt 自动恢复；成功清零。
 */
class PasswordResetLockTest extends PasswordResetApiTestBase {

    private static final LocalDateTime FIRST = MutableClock.START.withNano(0);

    /** 每分钟一次错误尝试，返回各次的剩余次数。 */
    private List<Integer> failMinutely(String username, int times) throws Exception {
        List<Integer> remaining = new ArrayList<>();
        for (int i = 0; i < times; i++) {
            JsonNode error = assertError(reset(wrong(username)), ErrorCode.RESET_INFO_MISMATCH);
            remaining.add(error.get("details").get("remainingAttempts").asInt());
            clock.advance(Duration.ofMinutes(1));
        }
        return remaining;
    }

    private String unlocksAt(String username, boolean correctDetails) throws Exception {
        JsonNode error = assertError(reset(correctDetails ? correct(username) : wrong(username)),
                ErrorCode.PASSWORD_RESET_LOCKED);
        assertThat(error.get("details").size()).isEqualTo(1);
        return error.get("details").get("unlocksAt").asText();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"zhangsan", "nobody"})
    @DisplayName("第 7 次失败剩余 0，第 8 次起 429 PASSWORD_RESET_LOCKED，unlocksAt = 第一次失败 + 24 小时，不再记录；"
            + "不存在的用户名表现相同")
    void seventhFailureLocksTheUsername(String username) throws Exception {
        student("zhangsan");

        assertThat(failMinutely(username, 7)).containsExactly(6, 5, 4, 3, 2, 1, 0);

        assertThat(unlocksAt(username, false)).isEqualTo("2026-10-13T08:30:15");
        assertThat(unlocksAt(username, false)).isEqualTo("2026-10-13T08:30:15");
        assertThat(attempts(username, false)).isEqualTo(7);
    }

    @Test
    @DisplayName("锁定期间即使四项全对也不核对：仍为 PASSWORD_RESET_LOCKED，口令不变，不记成功")
    void lockedRequestIsNotVerified() throws Exception {
        long id = student("zhangsan");
        String hash = passwordHash(id);
        failMinutely("zhangsan", 7);

        assertThat(unlocksAt("zhangsan", true)).isEqualTo("2026-10-13T08:30:15");

        assertThat(passwordHash(id)).isEqualTo(hash);
        assertThat(attempts("zhangsan", true)).isZero();
    }

    @Test
    @DisplayName("用 Clock 推进：unlocksAt 前一秒仍锁定；到 unlocksAt 第一次失败移出窗口，恢复 1 次机会，再失败则按第二次失败重新锁定")
    void unlocksExactlyAtUnlocksAt() throws Exception {
        student("zhangsan");
        failMinutely("zhangsan", 7);

        clock.setLocal(FIRST.plusHours(24).minusSeconds(1));
        assertThat(unlocksAt("zhangsan", false)).isEqualTo("2026-10-13T08:30:15");

        clock.setLocal(FIRST.plusHours(24));
        JsonNode error = assertError(reset(wrong("zhangsan")), ErrorCode.RESET_INFO_MISMATCH);
        assertThat(error.get("details").get("remainingAttempts").asInt()).isZero();
        assertThat(unlocksAt("zhangsan", false)).isEqualTo("2026-10-13T08:31:15");
    }

    @Test
    @DisplayName("到 unlocksAt 后四项全对可以重置成功")
    void correctDetailsSucceedAfterUnlock() throws Exception {
        student("zhangsan");
        failMinutely("zhangsan", 7);

        clock.setLocal(FIRST.plusHours(24));

        assertThat(reset(correct("zhangsan")).getResponse().getStatus()).isEqualTo(204);
    }

    @Test
    @DisplayName("超过 24 小时的失败不计入")
    void failuresOlderThanTheWindowAreNotCounted() throws Exception {
        student("zhangsan");
        failMinutely("zhangsan", 6);

        clock.setLocal(FIRST.plusDays(2));

        assertThat(failMinutely("zhangsan", 2)).containsExactly(6, 5);
    }

    @Test
    @DisplayName("成功清零：只数最近一次成功之后的失败（同一秒内也按先后区分）")
    void successResetsTheCount() throws Exception {
        student("zhangsan");
        assertThat(failMinutely("zhangsan", 6)).containsExactly(6, 5, 4, 3, 2, 1);

        assertThat(reset(correct("zhangsan")).getResponse().getStatus()).isEqualTo(204);

        // 时钟不推进：之后的失败与成功同一秒，仍只数成功之后的
        JsonNode error = assertError(reset(wrong("zhangsan")), ErrorCode.RESET_INFO_MISMATCH);
        assertThat(error.get("details").get("remainingAttempts").asInt()).isEqualTo(6);
    }

    @Test
    @DisplayName("计数按用户名字符串区分大小写，互不影响")
    void usernamesAreCountedSeparately() throws Exception {
        student("zhangsan");
        failMinutely("zhangsan", 7);

        assertThat(failMinutely("ZhangSan", 1)).containsExactly(6);
        assertThat(failMinutely("lisi", 1)).containsExactly(6);
    }
}
