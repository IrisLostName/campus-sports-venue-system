package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * BE-7 T5（O2、O3）：缺省区间、SA 全部场馆与指定场馆、VA 只聚合授权场馆、无授权的 VA、byVenue 与 daily 的形状与排序、
 * 比率为 null 时键存在。现在为 TODAY 08:30:15。
 */
class StatsOverviewApiTest extends StatsTestBase {

    private static final List<String> TOP_KEYS = List.of("dateFrom", "dateTo", "reservationCount",
            "activeOccupiedSlots", "openSlots", "utilizationRate", "currentInUse", "userCancelCount",
            "adminCancelCount", "noShowRate", "byVenue", "daily");

    private long tennis;
    private long pool;
    private long closed;
    private long sysAdmin;
    private long tennisAdmin;
    private long lonelyAdmin;

    /**
     * 网球馆 2 片场地 × 每天 2 个时段；游泳馆 1 条泳道 × 1 个时段；关闭的场馆有 1 个保留的今天预约。
     * 近 7 天：K1 = 7（含 1 条用户取消、1 条管理员取消），K2 = 5，K3 = 35，在用 1，未到场 2（含 1 条越过判定点）、完成 1。
     */
    @BeforeEach
    void seed() {
        tennis = fixtures.bookableVenue("网球馆");
        long court1 = fixtures.resource(tennis, "1号", 1, "OPEN");
        long court2 = fixtures.resource(tennis, "2号", 2, "OPEN");
        fixtures.weeklyEveryDay(tennis, "08:00", "11:00");
        pool = fixtures.venue("游泳馆", false, "OPEN");
        long lane = fixtures.resource(pool, "1道", 1, "OPEN");
        fixtures.weeklyEveryDay(pool, "09:00", "10:30");
        closed = fixtures.venue("羽毛球馆", false, "CLOSED");
        long hall = fixtures.resource(closed, "1号", 1, "OPEN");
        fixtures.weeklyEveryDay(closed, "08:00", "09:30");
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        lonelyAdmin = user("admin_none", Role.VENUE_ADMIN);
        fixtures.grant(lonelyAdmin, pool, "REVOKED", null, null, sysAdmin);
        long owner = user("owner", Role.USER);
        long inUse = reservation(owner, court1, TODAY, "08:00", "CONFIRMED");
        fixtures.usage(inUse, TODAY.atTime(7, 55), null);
        reservation(owner, court2, TODAY.plusDays(1), "08:00", "CANCELLED");
        reservation(owner, court2, TODAY.minusDays(1), "08:00", "NO_SHOW", TODAY.minusDays(2).atTime(9, 0));
        reservation(owner, court1, TODAY.minusDays(1), "09:30", "COMPLETED", TODAY.minusDays(3).atTime(9, 0));
        reservation(owner, lane, TODAY, "09:00", "CONFIRMED", TODAY.minusDays(1).atTime(9, 0));
        reservation(owner, lane, TODAY.minusDays(2), "09:00", "ADMIN_CANCELLED", TODAY.minusDays(5).atTime(9, 0));
        reservation(owner, hall, TODAY, "08:00", "CONFIRMED", TODAY.minusDays(1).atTime(10, 0));
    }

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    @Test
    @DisplayName("SA 不带参数：近 7 天、全部场馆（含 CLOSED，按 id 升序）的各项数字")
    void sysAdminSeesEveryVenueOverTheLastSevenDays() throws Exception {
        JsonNode body = overviewOk(sysAdmin, Role.SYS_ADMIN);

        assertThat(keys(body)).containsExactlyElementsOf(TOP_KEYS);
        assertThat(body.get("dateFrom").asText()).isEqualTo(TODAY.minusDays(6).toString());
        assertThat(body.get("dateTo").asText()).isEqualTo(TODAY.toString());
        assertThat(body.get("reservationCount").asLong()).isEqualTo(7);
        assertThat(body.get("userCancelCount").asLong()).isEqualTo(1);
        assertThat(body.get("adminCancelCount").asLong()).isEqualTo(1);
        assertThat(body.get("activeOccupiedSlots").asLong()).isEqualTo(5);
        assertThat(body.get("openSlots").asLong()).isEqualTo(35);
        assertThat(body.get("utilizationRate").asDouble()).isEqualTo(5.0 / 35);
        assertThat(body.get("currentInUse").asLong()).isEqualTo(1);
        assertThat(body.get("noShowRate").asDouble()).isEqualTo(2.0 / 3);
        assertThat(body.get("byVenue").findValuesAsText("venueId"))
                .containsExactly(String.valueOf(tennis), String.valueOf(pool), String.valueOf(closed));
        assertThat(body.get("byVenue").findValuesAsText("venueName")).containsExactly("网球馆", "游泳馆", "羽毛球馆");
        assertThat(body.get("byVenue").findValuesAsText("reservationCount")).containsExactly("4", "2", "1");
        assertThat(body.get("byVenue").get(0).get("utilizationRate").asDouble()).isEqualTo(3.0 / 28);
        assertThat(body.get("byVenue").get(1).get("utilizationRate").asDouble()).isEqualTo(1.0 / 7);
        assertThat(body.get("byVenue").get(2).get("utilizationRate").isNull()).isTrue();
    }

    @Test
    @DisplayName("byVenue 与 daily 的键与排序：daily 逐日升序，按创建日期计数、按服务日期算利用率")
    void breakdownShapes() throws Exception {
        JsonNode body = overviewOk(sysAdmin, Role.SYS_ADMIN);

        for (JsonNode venue : body.get("byVenue")) {
            assertThat(keys(venue)).containsExactly("venueId", "venueName", "reservationCount", "utilizationRate");
        }
        JsonNode daily = body.get("daily");
        assertThat(daily).hasSize(7);
        for (JsonNode day : daily) {
            assertThat(keys(day)).containsExactly("date", "reservationCount", "utilizationRate");
        }
        assertThat(daily.findValuesAsText("date")).containsExactly(TODAY.minusDays(6).toString(),
                TODAY.minusDays(5).toString(), TODAY.minusDays(4).toString(), TODAY.minusDays(3).toString(),
                TODAY.minusDays(2).toString(), TODAY.minusDays(1).toString(), TODAY.toString());
        assertThat(daily.findValuesAsText("reservationCount")).containsExactly("0", "1", "0", "1", "1", "2", "2");
        assertThat(daily.get(6).get("utilizationRate").asDouble()).isEqualTo(0.6);
        assertThat(daily.get(5).get("utilizationRate").asDouble()).isEqualTo(0.4);
        assertThat(daily.get(4).get("utilizationRate").asDouble()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("缺省区间：都不给为近 7 天；只给 dateTo 为其前 6 天起；只给 dateFrom 为其至今天")
    void defaultRanges() throws Exception {
        JsonNode onlyTo = overviewOk(sysAdmin, Role.SYS_ADMIN, "dateTo", "2026-10-01");
        assertThat(onlyTo.get("dateFrom").asText()).isEqualTo("2026-09-25");
        assertThat(onlyTo.get("dateTo").asText()).isEqualTo("2026-10-01");
        assertThat(onlyTo.get("daily")).hasSize(7);

        JsonNode onlyFrom = overviewOk(sysAdmin, Role.SYS_ADMIN, "dateFrom", "2026-10-01");
        assertThat(onlyFrom.get("dateFrom").asText()).isEqualTo("2026-10-01");
        assertThat(onlyFrom.get("dateTo").asText()).isEqualTo(TODAY.toString());
        assertThat(onlyFrom.get("daily")).hasSize(12);
        assertThat(onlyFrom.get("reservationCount").asLong()).isEqualTo(7);
    }

    @Test
    @DisplayName("SA 指定场馆只统计该场馆；currentInUse 也限于该场馆")
    void sysAdminMayNarrowToOneVenue() throws Exception {
        JsonNode body = overviewOk(sysAdmin, Role.SYS_ADMIN, "venueId", String.valueOf(pool));

        assertThat(body.get("byVenue")).hasSize(1);
        assertThat(body.get("byVenue").get(0).get("venueId").asLong()).isEqualTo(pool);
        assertThat(body.get("reservationCount").asLong()).isEqualTo(2);
        assertThat(body.get("openSlots").asLong()).isEqualTo(7);
        assertThat(body.get("currentInUse").asLong()).isZero();
        assertThat(body.get("noShowRate").isNull()).isTrue();
    }

    @Test
    @DisplayName("VA 不带 venueId 只聚合授权场馆")
    void venueAdminAggregatesGrantedVenuesOnly() throws Exception {
        JsonNode body = overviewOk(tennisAdmin, Role.VENUE_ADMIN);

        assertThat(body.get("byVenue").findValuesAsText("venueId")).containsExactly(String.valueOf(tennis));
        assertThat(body.get("reservationCount").asLong()).isEqualTo(4);
        assertThat(body.get("openSlots").asLong()).isEqualTo(28);
        assertThat(body.get("activeOccupiedSlots").asLong()).isEqualTo(3);
        assertThat(body.get("currentInUse").asLong()).isEqualTo(1);
        assertThat(body.get("noShowRate").asDouble()).isEqualTo(0.5);
        assertThat(overviewOk(tennisAdmin, Role.VENUE_ADMIN, "venueId", String.valueOf(tennis)).get("byVenue"))
                .hasSize(1);
    }

    @Test
    @DisplayName("无有效授权的 VA：计数为 0、比率为 null（键存在）、byVenue 为空、daily 仍逐日给出")
    void venueAdminWithoutScopeGetsZerosAndNulls() throws Exception {
        JsonNode body = overviewOk(lonelyAdmin, Role.VENUE_ADMIN);

        assertThat(keys(body)).containsExactlyElementsOf(TOP_KEYS);
        assertThat(body.get("reservationCount").asLong()).isZero();
        assertThat(body.get("activeOccupiedSlots").asLong()).isZero();
        assertThat(body.get("openSlots").asLong()).isZero();
        assertThat(body.get("currentInUse").asLong()).isZero();
        assertThat(body.get("userCancelCount").asLong()).isZero();
        assertThat(body.get("adminCancelCount").asLong()).isZero();
        assertThat(body.get("utilizationRate").isNull()).isTrue();
        assertThat(body.get("noShowRate").isNull()).isTrue();
        assertThat(body.get("byVenue").isArray()).isTrue();
        assertThat(body.get("byVenue")).isEmpty();
        assertThat(body.get("daily")).hasSize(7);
        for (JsonNode day : body.get("daily")) {
            assertThat(day.get("reservationCount").asLong()).isZero();
            assertThat(day.has("utilizationRate")).isTrue();
            assertThat(day.get("utilizationRate").isNull()).isTrue();
        }
    }
}
