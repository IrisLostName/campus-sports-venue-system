package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.campus.venue.stats.domain.ResourceLiveState;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * BE-7 T6 场地实时状态（经 GET /display/summary）：五种状态与优先级；RESERVED 的当前时段与下一时段、开馆前、
 * 窗口间空档、闭馆后（FE-1 F2）；下一时段只比较开始时刻（R-N1）；越过未到场判定点后回到 FREE；签退后不再 IN_USE；
 * 提前签到在开始前为 FREE（裁决第 9 节第 3 条）。网球馆每天开放 08:00–11:00、14:00–17:00。
 */
class LiveStateApiTest extends StatsTestBase {

    private static final Path CONTRACT = Path.of("..", "docs", "12-api-contract.md");
    private static final Pattern BACKTICKED = Pattern.compile("`([A-Z_a-z]+)`");

    private long tennis;
    private long owner;

    @BeforeEach
    void seed() {
        tennis = fixtures.bookableVenue("网球馆");
        fixtures.weekly(tennis, 1, "08:00", "11:00");
        fixtures.weekly(tennis, 1, "14:00", "17:00");
        owner = user("owner", Role.USER);
    }

    private void at(LocalTime time) {
        clock.setLocal(TODAY.atTime(time));
    }

    private static String stateOf(JsonNode body, long resourceId) {
        for (JsonNode resource : body.get("resources")) {
            if (resource.get("resourceId").asLong() == resourceId) {
                return resource.get("state").asText();
            }
        }
        return fail("大屏没有场地 " + resourceId);
    }

    private String stateNow(long resourceId) throws Exception {
        return stateOf(summaryOk(), resourceId);
    }

    @Test
    @DisplayName("五种状态与优先级：维护中、场馆关闭或被关闭规则覆盖的场地即使在使用也为 MAINTENANCE；按场馆、sortOrder 排序")
    void fiveStatesWithPriority() throws Exception {
        long free = fixtures.resource(tennis, "6号", 6, "OPEN");
        long disabled = fixtures.resource(tennis, "1号", 1, "DISABLED");
        long maintenance = fixtures.resource(tennis, "2号", 2, "MAINTENANCE");
        long closedByRule = fixtures.resource(tennis, "3号", 3, "OPEN");
        long inUse = fixtures.resource(tennis, "4号", 4, "OPEN");
        long reserved = fixtures.resource(tennis, "5号", 5, "OPEN");
        fixtures.closure(tennis, closedByRule, TODAY, TODAY);
        long closedVenue = fixtures.venue("游泳馆", false, "CLOSED");
        long lane = fixtures.resource(closedVenue, "1道", 1, "OPEN");
        for (long resource : List.of(maintenance, closedByRule, inUse, lane)) {
            fixtures.usage(reservation(owner, resource, TODAY, "08:00", "CONFIRMED"), TODAY.atTime(7, 55), null);
        }
        reservation(owner, reserved, TODAY, "09:30", "CONFIRMED");

        JsonNode body = summaryOk();

        assertThat(body.get("resources").findValuesAsText("resourceId")).containsExactly(String.valueOf(disabled),
                String.valueOf(maintenance), String.valueOf(closedByRule), String.valueOf(inUse),
                String.valueOf(reserved), String.valueOf(free), String.valueOf(lane));
        assertThat(body.get("resources").findValuesAsText("state")).containsExactly("DISABLED", "MAINTENANCE",
                "MAINTENANCE", "IN_USE", "RESERVED", "FREE", "MAINTENANCE");
        JsonNode board = body.get("venues").get(0);
        assertThat(board.get("resourceTotal").asLong()).isEqualTo(5);
        assertThat(board.get("resourceOpen").asLong()).isEqualTo(4);
        assertThat(board.get("resourcesReservedNow").asLong()).isEqualTo(2);
        JsonNode closedBoard = body.get("venues").get(1);
        assertThat(closedBoard.get("operationalStatus").asText()).isEqualTo("CLOSED");
        assertThat(closedBoard.get("resourceOpen").asLong()).isEqualTo(1);
        assertThat(closedBoard.get("resourcesReservedNow").asLong()).isZero();
        assertThat(body.get("currentInUse").asLong()).isEqualTo(4);
    }

    @Test
    @DisplayName("整馆关闭规则覆盖今天：全部场地 MAINTENANCE")
    void wholeVenueClosureMeansMaintenance() throws Exception {
        long court = fixtures.resource(tennis, "1号", 1, "OPEN");
        fixtures.closure(tennis, null, TODAY.minusDays(1), TODAY);
        reservation(owner, court, TODAY, "09:30", "CONFIRMED");

        assertThat(stateNow(court)).isEqualTo("MAINTENANCE");
    }

    @Test
    @DisplayName("当前时段的未签到预约为 RESERVED，正好在 开始 + 15 分钟 仍是，越过未到场判定点后回到 FREE")
    void currentSlotIsReservedUntilTheNoShowPoint() throws Exception {
        long court = fixtures.resource(tennis, "1号", 1, "OPEN");
        reservation(owner, court, TODAY, "08:00", "CONFIRMED");

        at(LocalTime.of(8, 10));
        assertThat(stateNow(court)).isEqualTo("RESERVED");
        at(LocalTime.of(8, 15));
        assertThat(stateNow(court)).isEqualTo("RESERVED");
        at(LocalTime.of(8, 15, 1));
        assertThat(stateNow(court)).isEqualTo("FREE");
    }

    @Test
    @DisplayName("紧接着的下一时段的预约为 RESERVED，更晚的预约不触发；当前时段切换后按新的当前时段判断")
    void onlyTheNextSlotCounts() throws Exception {
        long next = fixtures.resource(tennis, "1号", 1, "OPEN");
        long later = fixtures.resource(tennis, "2号", 2, "OPEN");
        reservation(owner, next, TODAY, "09:30", "CONFIRMED");
        reservation(owner, later, TODAY, "14:00", "CONFIRMED");

        JsonNode now = summaryOk();
        assertThat(stateOf(now, next)).isEqualTo("RESERVED");
        assertThat(stateOf(now, later)).isEqualTo("FREE");
        at(LocalTime.of(9, 29, 59));
        assertThat(stateNow(next)).isEqualTo("RESERVED");
        at(LocalTime.of(10, 59, 59));
        assertThat(stateNow(later)).isEqualTo("FREE");
    }

    @Test
    @DisplayName("开馆前、窗口间空档、闭馆后没有当前时段，之后的预约不触发 RESERVED；区间包含现在的保留预约仍为 RESERVED")
    void noCurrentSlotMeansNoNextSlot() throws Exception {
        long morning = fixtures.resource(tennis, "1号", 1, "OPEN");
        long afternoon = fixtures.resource(tennis, "2号", 2, "OPEN");
        long evening = fixtures.resource(tennis, "3号", 3, "OPEN");
        reservation(owner, morning, TODAY, "08:00", "CONFIRMED");
        reservation(owner, afternoon, TODAY, "14:00", "CONFIRMED");
        reservation(owner, evening, TODAY, "18:00", "CONFIRMED");

        at(LocalTime.of(7, 59, 59));
        assertThat(stateNow(morning)).isEqualTo("FREE");
        at(LocalTime.of(12, 30));
        assertThat(stateNow(afternoon)).isEqualTo("FREE");
        at(LocalTime.of(17, 30));
        assertThat(stateNow(evening)).isEqualTo("FREE");
        at(LocalTime.of(18, 5));
        assertThat(stateNow(evening)).isEqualTo("RESERVED");
    }

    @Test
    @DisplayName("R-N1：下一时段只比较开始时刻，不核对它是否仍是派生时段")
    void nextSlotIsMatchedByStartTimeOnly() throws Exception {
        long venue = fixtures.bookableVenue("羽毛球馆");
        fixtures.weekly(venue, 1, "08:00", "09:30");
        long court = fixtures.resource(venue, "1号", 1, "OPEN");
        reservation(owner, court, TODAY, "09:30", "CONFIRMED");

        assertThat(stateNow(court)).isEqualTo("RESERVED");
    }

    @Test
    @DisplayName("签退后不再 IN_USE（也不是 RESERVED）；提前签到在开始前为 FREE，开始时刻起为 IN_USE")
    void checkOutAndEarlyCheckIn() throws Exception {
        long left = fixtures.resource(tennis, "1号", 1, "OPEN");
        long early = fixtures.resource(tennis, "2号", 2, "OPEN");
        fixtures.usage(reservation(owner, left, TODAY, "08:00", "CONFIRMED"), TODAY.atTime(7, 55),
                TODAY.atTime(8, 20));
        fixtures.usage(reservation(owner, early, TODAY, "09:30", "CONFIRMED"), TODAY.atTime(9, 20), null);

        assertThat(stateNow(left)).isEqualTo("FREE");
        at(LocalTime.of(9, 25));
        JsonNode beforeStart = summaryOk();
        assertThat(stateOf(beforeStart, early)).isEqualTo("FREE");
        assertThat(beforeStart.get("currentInUse").asLong()).isZero();
        at(LocalTime.of(9, 30));
        JsonNode started = summaryOk();
        assertThat(stateOf(started, early)).isEqualTo("IN_USE");
        assertThat(started.get("currentInUse").asLong()).isEqualTo(1);
    }

    @Test
    @DisplayName("ResourceLiveState 的取值与 docs/12 第 2 节一致")
    void liveStateMatchesTheContract() throws IOException {
        if (!Files.isRegularFile(CONTRACT)) {
            fail("找不到接口契约文件：" + CONTRACT.toAbsolutePath().normalize());
        }
        String row = Files.readAllLines(CONTRACT, StandardCharsets.UTF_8).stream()
                .filter(line -> line.startsWith("| `ResourceLiveState`"))
                .findFirst()
                .orElseGet(() -> fail("docs/12 第 2 节没有 ResourceLiveState"));
        Matcher matcher = BACKTICKED.matcher(row.split("\\|")[2]);
        List<String> values = new ArrayList<>();
        while (matcher.find()) {
            values.add(matcher.group(1));
        }

        assertThat(values).containsExactlyInAnyOrderElementsOf(
                Arrays.stream(ResourceLiveState.values()).map(Enum::name).toList());
    }
}
