package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * BE-5 A1、T5：GET /admin/reservations 的过滤条件。日期两端含、dateFrom 晚于 dateTo 得空页（P1）；
 * status 按有效状态过滤（BE-3 E1，与响应中的 status 一致）；keyword 去首尾空白、不区分大小写地包含匹配用户名、姓名、场地名，
 * %、_、反斜杠按字面匹配。时钟 2026-10-12 08:30:15。
 */
class AdminReservationListFilterTest extends AdminReservationApiTestBase {

    @Test
    @DisplayName("日期范围两端含；只给一端也生效")
    void dateRangeIsInclusive() throws Exception {
        long today = reservation(zhangsan, court1, TODAY, "18:00");
        long tomorrow = reservation(zhangsan, court1, TOMORROW, "18:00");
        long later = reservation(zhangsan, court1, TODAY.plusDays(2), "18:00");

        assertThat(itemIds(listAsSys("dateFrom", TOMORROW.toString(), "dateTo", TOMORROW.toString())))
                .containsExactly(tomorrow);
        assertThat(itemIds(listAsSys("dateFrom", TODAY.toString(), "dateTo", TOMORROW.toString())))
                .containsExactly(tomorrow, today);
        assertThat(itemIds(listAsSys("dateFrom", TOMORROW.toString()))).containsExactly(later, tomorrow);
        assertThat(itemIds(listAsSys("dateTo", TOMORROW.toString()))).containsExactly(tomorrow, today);
    }

    @Test
    @DisplayName("P1 dateFrom 晚于 dateTo 不报错，得空页（total 0）")
    void reversedDateRangeIsAnEmptyPage() throws Exception {
        reservation(zhangsan, court1, TOMORROW, "18:00");

        JsonNode page = ok(listAsSys("dateFrom", TOMORROW.toString(), "dateTo", TODAY.toString()));

        assertThat(page.get("items")).isEmpty();
        assertThat(page.get("total").asLong()).isZero();
    }

    @Test
    @DisplayName("status 按有效状态过滤：库中 CONFIRMED 但已越过判定点的出现在 NO_SHOW / COMPLETED 下而不在 CONFIRMED 下")
    void statusFiltersByEffectiveStatus() throws Exception {
        long noShowDue = reservation(zhangsan, court1, TODAY, "08:00");
        long completionDue = reservation(zhangsan, court2, TODAY, "06:30");
        fixtures.usage(completionDue, TODAY.atTime(6, 25), null);
        long inUse = reservation(lisi, court3, TODAY, "08:00");
        fixtures.usage(inUse, TODAY.atTime(7, 50), null);
        long upcoming = reservation(lisi, court1, TOMORROW, "08:00");
        long storedNoShow = fixtures.reservation(lisi, court4, TODAY, "06:30", "NO_SHOW");
        long cancelled = fixtures.reservation(lisi, court4, TODAY, "08:00", "CANCELLED");
        long adminCancelled = fixtures.reservation(lisi, court4, TOMORROW, "08:00", "ADMIN_CANCELLED");
        long storedCompleted = fixtures.reservation(lisi, court4, TODAY.minusDays(1), "08:00", "COMPLETED");

        assertThat(itemIds(listAsSys("status", "CONFIRMED"))).containsExactly(upcoming, inUse);
        assertThat(itemIds(listAsSys("status", "NO_SHOW"))).containsExactly(noShowDue, storedNoShow);
        assertThat(itemIds(listAsSys("status", "COMPLETED"))).containsExactly(completionDue, storedCompleted);
        assertThat(itemIds(listAsSys("status", "CANCELLED"))).containsExactly(cancelled);
        assertThat(itemIds(listAsSys("status", "ADMIN_CANCELLED"))).containsExactly(adminCancelled);
        assertThat(json(listAsSys("status", "CONFIRMED")).get("total").asLong()).isEqualTo(2);
        assertThat(json(listAsSys("status", "NO_SHOW")).get("total").asLong()).isEqualTo(2);

        Map<Long, String> statuses = new HashMap<>();
        ok(listAsSys()).get("items").forEach(item -> statuses.put(item.get("id").asLong(),
                item.get("status").asText()));
        assertThat(statuses).containsEntry(noShowDue, "NO_SHOW").containsEntry(completionDue, "COMPLETED")
                .containsEntry(inUse, "CONFIRMED").hasSize(8);
    }

    @Test
    @DisplayName("有效状态过滤同样受场馆范围与日期限制：VENUE_ADMIN 看不到其他场馆越过判定点的记录")
    void effectiveStatusFilterRespectsScopeAndDates() throws Exception {
        long tennisDue = reservation(zhangsan, court1, TODAY, "08:00");
        reservation(lisi, badmintonCourt, TODAY, "08:00");
        long yesterdayDue = reservation(zhangsan, court2, TODAY.minusDays(1), "08:00");

        assertThat(itemIds(listAsTennisAdmin("status", "NO_SHOW"))).containsExactly(tennisDue, yesterdayDue);
        assertThat(itemIds(listAsTennisAdmin("status", "NO_SHOW", "dateFrom", TODAY.toString())))
                .containsExactly(tennisDue);
        assertThat(itemIds(listAsTennisAdmin("status", "CONFIRMED"))).isEmpty();
    }

    @Test
    @DisplayName("keyword 匹配用户名、姓名、场地名，不区分大小写，去掉首尾空白；空白视为未填")
    void keywordMatchesThreeFieldsCaseInsensitively() throws Exception {
        long zhang = reservation(zhangsan, court1, TOMORROW, "08:00");
        long li = reservation(lisi, court2, TOMORROW, "09:30");
        long bob = reservation(user("Bob", Role.USER), court3, TOMORROW, "11:00");

        assertThat(itemIds(listAsSys("keyword", "ZHANG"))).containsExactly(zhang);
        assertThat(itemIds(listAsSys("keyword", "用户li"))).containsExactly(li);
        assertThat(itemIds(listAsSys("keyword", "网球场2"))).containsExactly(li);
        assertThat(itemIds(listAsSys("keyword", "bOB"))).containsExactly(bob);
        assertThat(itemIds(listAsSys("keyword", "  lisi  "))).containsExactly(li);
        assertThat(itemIds(listAsSys("keyword", "网球场"))).containsExactly(bob, li, zhang);
        assertThat(itemIds(listAsSys("keyword", "   "))).containsExactly(bob, li, zhang);
        assertThat(itemIds(listAsSys("keyword", "nobody"))).isEmpty();
    }

    @Test
    @DisplayName("keyword 中的 %、_、反斜杠按字面匹配，不作通配符")
    void keywordWildcardsAreLiteral() throws Exception {
        long underscore = reservation(user("a_b", Role.USER), court1, TOMORROW, "08:00");
        long plain = reservation(user("axb", Role.USER), court2, TOMORROW, "08:00");
        long percent = reservation(user("p%q", Role.USER), court3, TOMORROW, "08:00");
        long backslash = reservation(user("c\\d", Role.USER), court4, TOMORROW, "08:00");

        assertThat(itemIds(listAsSys("keyword", "a_b"))).containsExactly(underscore);
        assertThat(itemIds(listAsSys("keyword", "_"))).containsExactly(underscore);
        assertThat(itemIds(listAsSys("keyword", "%"))).containsExactly(percent);
        assertThat(itemIds(listAsSys("keyword", "p%q"))).containsExactly(percent);
        assertThat(itemIds(listAsSys("keyword", "c\\d"))).containsExactly(backslash);
        assertThat(itemIds(listAsSys("keyword", "\\"))).containsExactly(backslash);
        assertThat(itemIds(listAsSys("keyword", "axb"))).containsExactly(plain);
    }

    @Test
    @DisplayName("条件组合：venueId + 日期 + status + keyword 同时生效")
    void filtersCombine() throws Exception {
        long match = reservation(zhangsan, court1, TOMORROW, "08:00");
        reservation(zhangsan, court1, TODAY.plusDays(2), "08:00");
        reservation(lisi, court2, TOMORROW, "08:00");
        reservation(zhangsan, badmintonCourt, TOMORROW, "08:00");

        assertThat(itemIds(listAsSys("venueId", String.valueOf(tennis), "dateFrom", TOMORROW.toString(),
                "dateTo", TOMORROW.toString(), "status", "CONFIRMED", "keyword", "zhang")))
                .containsExactly(match);
    }
}
