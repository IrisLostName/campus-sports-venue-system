package com.campus.venue.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-7 T5（O1、O2 的阶段顺序）：认证 → 格式 → 补缺省区间 → 区间天数 → 角色 → 场馆范围（授权检查先于 NOT_FOUND），
 * 每一步至少一例并证明相邻先后；366 天可、367 天不可、dateFrom 晚于 dateTo 不可。TODAY 为 2026-10-12。
 */
class StatsOverviewPhaseOrderTest extends StatsTestBase {

    private static final String RANGE_PROBLEM = "日期范围应为 1–366 天";
    private static final String TOO_EARLY = TODAY.minusDays(400).toString();

    private long tennis;
    private long pool;
    private long sysAdmin;
    private long tennisAdmin;
    private long student;

    @BeforeEach
    void seed() {
        tennis = fixtures.bookableVenue("网球馆");
        pool = fixtures.venue("游泳馆", false, "OPEN");
        sysAdmin = user("sysadmin", Role.SYS_ADMIN);
        tennisAdmin = user("admin_tennis", Role.VENUE_ADMIN);
        fixtures.grant(tennisAdmin, tennis, sysAdmin);
        student = user("zhangsan", Role.USER);
    }

    private static List<String> names(JsonNode fields) {
        List<String> names = new ArrayList<>();
        fields.fieldNames().forEachRemaining(names::add);
        return names;
    }

    @Test
    @DisplayName("认证先于格式：无令牌且参数非法得 AUTH_REQUIRED")
    void authenticationComesFirst() throws Exception {
        MvcResult result = mockMvc.perform(get(OVERVIEW).param("venueId", "abc")).andReturn();

        assertError(result, ErrorCode.AUTH_REQUIRED);
    }

    @Test
    @DisplayName("格式：venueId 类型不符或非正、日期非严格 yyyy-MM-dd，各报在对应字段")
    void formatErrorsNameTheField() throws Exception {
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "venueId", "abc")).get("venueId").asText())
                .isEqualTo("类型不符");
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "venueId", "0")).get("venueId").asText())
                .isEqualTo("应为正整数");
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", "2026-1-5")).get("dateFrom").asText())
                .isEqualTo("类型不符");
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateTo", "2026-02-30")).get("dateTo").asText())
                .isEqualTo("类型不符");
    }

    @Test
    @DisplayName("格式先于区间检查：格式错误时不报区间天数")
    void formatErrorsSkipTheRangeCheck() throws Exception {
        assertThat(names(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "venueId", "0", "dateFrom", TOO_EARLY))))
                .containsExactly("venueId");
        assertThat(names(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "venueId", "abc", "dateFrom", TOO_EARLY))))
                .containsExactly("venueId");
        JsonNode fields = fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", TOO_EARLY, "dateTo", "2026/10/12"));
        assertThat(names(fields)).containsExactly("dateTo");
    }

    @Test
    @DisplayName("区间检查先于角色：USER 带 400 天区间得 VALIDATION_ERROR fields.dateFrom，区间合法时得 FORBIDDEN")
    void rangeErrorComesBeforeTheRole() throws Exception {
        JsonNode fields = fieldsOf(overview(student, Role.USER, "dateFrom", TOO_EARLY));
        assertThat(names(fields)).containsExactly("dateFrom");
        assertThat(fields.get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);

        assertError(overview(student, Role.USER), ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("角色先于场馆范围：USER 指定其他场馆得 FORBIDDEN；区间检查也先于范围检查")
    void roleAndRangeComeBeforeTheScope() throws Exception {
        assertError(overview(student, Role.USER, "venueId", String.valueOf(pool)), ErrorCode.FORBIDDEN);
        assertThat(fieldsOf(overview(tennisAdmin, Role.VENUE_ADMIN, "venueId", String.valueOf(pool),
                "dateFrom", TOO_EARLY)).get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);
        JsonNode body = assertError(overview(tennisAdmin, Role.VENUE_ADMIN, "venueId", String.valueOf(pool)),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(pool);
    }

    @Test
    @DisplayName("授权检查先于 NOT_FOUND：VA 查不存在的场馆得 FORBIDDEN_SCOPE，SA 得 NOT_FOUND")
    void scopeCheckComesBeforeNotFound() throws Exception {
        JsonNode body = assertError(overview(tennisAdmin, Role.VENUE_ADMIN, "venueId", "999999"),
                ErrorCode.FORBIDDEN_SCOPE);
        assertThat(body.get("details").get("venueId").asLong()).isEqualTo(999999);

        assertError(overview(sysAdmin, Role.SYS_ADMIN, "venueId", "999999"), ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("366 天可、367 天不可、dateFrom 晚于 dateTo 不可、同一天可")
    void rangeOf366DaysIsTheLimit() throws Exception {
        JsonNode longest = overviewOk(sysAdmin, Role.SYS_ADMIN,
                "dateFrom", TODAY.minusDays(365).toString(), "dateTo", TODAY.toString());
        assertThat(longest.get("daily")).hasSize(366);

        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.minusDays(366).toString(),
                "dateTo", TODAY.toString())).get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.plusDays(1).toString(),
                "dateTo", TODAY.toString())).get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);
        assertThat(overviewOk(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.toString(), "dateTo", TODAY.toString())
                .get("daily")).hasSize(1);
    }

    @Test
    @DisplayName("只给 dateFrom 时按今天补 dateTo 再检查天数")
    void onlyDateFromIsMeasuredAgainstToday() throws Exception {
        assertThat(overviewOk(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.minusDays(365).toString())
                .get("daily")).hasSize(366);
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.minusDays(366).toString()))
                .get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);
        assertThat(fieldsOf(overview(sysAdmin, Role.SYS_ADMIN, "dateFrom", TODAY.plusDays(1).toString()))
                .get("dateFrom").asText()).isEqualTo(RANGE_PROBLEM);
    }
}
