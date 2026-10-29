package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.TestUsers;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * P2-2b：POST /reservations 的 companionUserIds（docs/12 第 5.3 节、docs/10 第 1 节步骤 8a，契约 v1.2）。
 * 格式阶段：至多 6、正整数、不重复、不含本人；业务阶段步骤 8a（第 8 步之后）：存在、ACTIVE、USER。
 * 名单与预约同一事务写入，按提交顺序；同行人不占用自己的持有名额。
 */
@DisplayName("P2-2b 创建预约时附加同行人")
class ReservationCompanionCreateTest extends ReservationApiTestBase {

    private final List<Long> friends = new ArrayList<>();

    @BeforeEach
    void seedFriends() {
        for (int i = 1; i <= 7; i++) {
            friends.add(user("friend" + i, Role.USER));
        }
    }

    private static String body(long resourceId, LocalDate date, String start, String companions) {
        return "{\"resourceId\":" + resourceId + ",\"serviceDate\":\"" + date + "\",\"startTime\":\"" + start
                + "\",\"companionUserIds\":" + companions + "}";
    }

    private static String ids(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(",", "[", "]"));
    }

    private MvcResult createWith(long userId, long resourceId, LocalDate date, String start, String companions)
            throws Exception {
        return create(userBearer(userId), body(resourceId, date, start, companions));
    }

    private void invalidCompanions(MvcResult result, String message) throws Exception {
        JsonNode body = assertError(result, ErrorCode.VALIDATION_ERROR);
        assertThat(body.get("details").get("fields").get("companionUserIds").asText()).isEqualTo(message);
    }

    private int companionRows() {
        return jdbc.queryForObject("select count(*) from reservation_companion", Integer.class);
    }

    private int reservationRows() {
        return jdbc.queryForObject("select count(*) from reservation", Integer.class);
    }

    private List<Long> storedOrder(long reservationId) {
        return jdbc.queryForList("select user_id from reservation_companion where reservation_id = ?"
                + " order by position", Long.class, reservationId);
    }

    private static List<Long> responseOrder(JsonNode body) {
        List<Long> ids = new ArrayList<>();
        body.get("companions").forEach(companion -> ids.add(companion.get("userId").asLong()));
        return ids;
    }

    @Test
    @DisplayName("0 个：缺省、null、空数组都得到空名单")
    void noCompanions() throws Exception {
        for (String companions : List.of("null", "[]")) {
            MvcResult result = createWith(zhangsan, court1, TOMORROW, companions.equals("null") ? "09:30" : "11:00",
                    companions);
            assertThat(result.getResponse().getStatus()).isEqualTo(201);
            assertThat(json(result).get("companions")).isEmpty();
        }
        assertThat(companionRows()).isZero();
    }

    @Test
    @DisplayName("6 个：按提交顺序返回并写入 position 1–6，displayName 为同行人显示名")
    void sixCompanionsKeepTheirOrder() throws Exception {
        List<Long> six = List.of(friends.get(4), friends.get(0), friends.get(5), friends.get(2), friends.get(1),
                friends.get(3));

        MvcResult result = createWith(zhangsan, court1, TOMORROW, "09:30", ids(six));

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = json(result);
        assertThat(responseOrder(body)).containsExactlyElementsOf(six);
        assertThat(body.get("companions").get(0).get("displayName").asText()).isEqualTo("用户friend5");
        List<String> keys = new ArrayList<>();
        body.get("companions").get(0).fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("userId", "displayName");
        long id = body.get("id").asLong();
        assertThat(storedOrder(id)).containsExactlyElementsOf(six);
        assertThat(jdbc.queryForList("select position from reservation_companion where reservation_id = ?"
                + " order by position", Integer.class, id)).containsExactly(1, 2, 3, 4, 5, 6);
    }

    @Test
    @DisplayName("格式阶段：7 个、重复、包含本人、0 或负数或 null 元素 → VALIDATION_ERROR（fields.companionUserIds），不写库")
    void formatProblems() throws Exception {
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", ids(friends)), "最多 6 人");
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30",
                ids(List.of(friends.get(0), friends.get(0)))), "不能重复");
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(friends.get(0), zhangsan))),
                "不能包含本人");
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", "[0]"), "应为正整数");
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", "[-1]"), "应为正整数");
        invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", "[" + friends.get(0) + ",null]"),
                "应为正整数");

        assertThat(reservationRows()).isZero();
        assertThat(companionRows()).isZero();
    }

    @Test
    @DisplayName("格式先于业务：companionUserIds 格式错误且场馆不可预约 → VALIDATION_ERROR")
    void formatBeforeBusinessSteps() throws Exception {
        long closed = fixtures.venue("羽毛球馆", true, "CLOSED");
        long closedCourt = fixtures.resource(closed, "羽毛球场1", 1, "OPEN");

        invalidCompanions(createWith(zhangsan, closedCourt, TOMORROW, "09:30", ids(List.of(zhangsan))),
                "不能包含本人");
    }

    @Test
    @DisplayName("格式先于角色：VA 提交含重复 id 的名单 → VALIDATION_ERROR；合法名单 → FORBIDDEN")
    void formatBeforeRole() throws Exception {
        long venueAdmin = user("venue_admin", Role.VENUE_ADMIN);
        String admin = bearer(venueAdmin, Role.VENUE_ADMIN);

        invalidCompanions(create(admin, body(court1, TOMORROW, "09:30", "[3,3]")), "不能重复");
        invalidCompanions(create(admin, body(court1, TOMORROW, "09:30", "[" + venueAdmin + "]")), "不能包含本人");
        assertError(create(admin, body(court1, TOMORROW, "09:30", ids(List.of(lisi)))), ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("步骤 8a：不存在、停用、管理员 id → VALIDATION_ERROR（同一文案），不写库")
    void businessStepRejectsIneligibleUsers() throws Exception {
        long disabled = TestUsers.insert(jdbc, "disabled_user", Role.USER, AccountStatus.DISABLED);
        long venueAdmin = user("venue_admin", Role.VENUE_ADMIN);
        long sysAdmin = user("sys_admin", Role.SYS_ADMIN);

        for (long bad : List.of(999_999L, disabled, venueAdmin, sysAdmin)) {
            invalidCompanions(createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(friends.get(0), bad))),
                    "包含无效的用户");
        }
        assertThat(reservationRows()).isZero();
        assertThat(companionRows()).isZero();
    }

    @Test
    @DisplayName("阶段顺序：无效同行人且时段已被占 → SLOT_TAKEN（第 8 步先于 8a），名单不残留")
    void slotTakenBeforeStep8a() throws Exception {
        fixtures.reservation(lisi, court1, TOMORROW, "09:30", "CONFIRMED");

        assertError(createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(999_999L))), ErrorCode.SLOT_TAKEN);
        assertError(createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(friends.get(0)))),
                ErrorCode.SLOT_TAKEN);
        assertThat(companionRows()).isZero();
    }

    @Test
    @DisplayName("阶段顺序：无效同行人且已达持有上限 → BOOKING_LIMIT_REACHED（第 7 步先于 8a）")
    void limitBeforeStep8a() throws Exception {
        for (String start : List.of("08:00", "11:00", "12:30")) {
            fixtures.reservation(zhangsan, court2, TOMORROW, start, "CONFIRMED");
        }

        assertError(createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(999_999L))),
                ErrorCode.BOOKING_LIMIT_REACHED);
        assertThat(companionRows()).isZero();
    }

    @Test
    @DisplayName("同行人不占用自己的名额：已达上限的用户仍可被列为同行人；被列入后仍能自己预约")
    void companionsKeepTheirOwnQuota() throws Exception {
        long busy = friends.get(0);
        for (String start : List.of("08:00", "11:00", "12:30")) {
            fixtures.reservation(busy, court2, TOMORROW, start, "CONFIRMED");
        }
        long free = friends.get(1);

        MvcResult listed = createWith(zhangsan, court1, TOMORROW, "09:30", ids(List.of(busy, free)));
        assertThat(listed.getResponse().getStatus()).isEqualTo(201);
        createWith(lisi, court1, TOMORROW, "14:00", ids(List.of(free)));

        for (String start : List.of("15:30", "17:00", "18:30")) {
            assertThat(create(free, court1, TOMORROW, start).getResponse().getStatus()).as(start).isEqualTo(201);
        }
        assertError(create(free, court2, TOMORROW, "18:30"), ErrorCode.BOOKING_LIMIT_REACHED);
    }
}
