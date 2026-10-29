package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

/**
 * P2-2b：人员改派（docs/12 第 5.7 节，v1.2）——新的预约人若在同行人名单中，从名单中移除；其余同行人顺序不变、
 * position 保留空档（裁决第 5 节第 4 条）；日志的 before 为移除前、after 为移除后。
 * target：zhangsan 明天 09:30 的网球场1，名单依次为 lisi、wangwu、zhaoliu。
 */
@DisplayName("P2-2b 人员改派与同行人名单")
class AdminReassignUserCompanionTest extends AdminReservationApiTestBase {

    private long target;
    private long wangwu;
    private long zhaoliu;

    @BeforeEach
    void seedTarget() {
        wangwu = user("wangwu", Role.USER);
        zhaoliu = user("zhaoliu", Role.USER);
        target = reservation(zhangsan, court1, TOMORROW, "09:30");
        fixtures.companion(target, lisi, 1);
        fixtures.companion(target, wangwu, 2);
        fixtures.companion(target, zhaoliu, 3);
    }

    private JsonNode reassign(long userId) throws Exception {
        return ok(asSys(HttpMethod.POST, REASSIGN_USER, body("userId", userId, "reason", "改由同行人负责"), target));
    }

    private static List<Long> companionIds(JsonNode reservation) {
        List<Long> ids = new ArrayList<>();
        reservation.get("companions").forEach(companion -> ids.add(companion.get("userId").asLong()));
        return ids;
    }

    private List<Map<String, Object>> rows() {
        return jdbc.queryForList("select user_id, position from reservation_companion where reservation_id = ?"
                + " order by position", target);
    }

    @Test
    @DisplayName("新预约人在名单中：从名单移除，其余顺序不变、position 保留空档；日志前后快照反映移除")
    void newOwnerIsRemovedFromTheList() throws Exception {
        JsonNode view = reassign(wangwu);

        assertThat(view.get("userId").asLong()).isEqualTo(wangwu);
        assertThat(companionIds(view)).containsExactly(lisi, zhaoliu);
        assertThat(rows()).containsExactly(Map.of("user_id", lisi, "position", 1),
                Map.of("user_id", zhaoliu, "position", 3));
        Map<String, Object> log = onlyLog();
        assertThat(companionIds(snapshot(log, "before_snapshot").get("object")))
                .containsExactly(lisi, wangwu, zhaoliu);
        assertThat(snapshot(log, "after_snapshot").get("object")).isEqualTo(view);
    }

    @Test
    @DisplayName("新预约人不在名单中：名单不变；原预约人不会被加入名单")
    void otherTargetLeavesTheListUnchanged() throws Exception {
        long sunqi = user("sunqi", Role.USER);

        JsonNode view = reassign(sunqi);

        assertThat(companionIds(view)).containsExactly(lisi, wangwu, zhaoliu);
        assertThat(rows()).hasSize(3);
    }

    @Test
    @DisplayName("改派给原预约人本人：名单不变")
    void reassignToTheSameOwnerKeepsTheList() throws Exception {
        assertThat(companionIds(reassign(zhangsan))).containsExactly(lisi, wangwu, zhaoliu);
    }
}
