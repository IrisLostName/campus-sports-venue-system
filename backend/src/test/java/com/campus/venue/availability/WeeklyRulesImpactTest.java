package com.campus.venue.availability;

import com.campus.venue.support.ImpactContractTests;
import com.campus.venue.user.domain.Role;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-2b T2：PUT /admin/venues/{id}/availability-rules/weekly 把每天改为 08:00–14:00（17:00 不再是时段）的影响检查六条。 */
class WeeklyRulesImpactTest extends ImpactContractTests {

    static List<Map<String, Object>> everyDay(String open, String close) {
        List<Map<String, Object>> windows = new ArrayList<>();
        for (int weekday = 1; weekday <= 7; weekday++) {
            windows.add(body("weekday", weekday, "openTime", open, "closeTime", close));
        }
        return windows;
    }

    @Override
    protected MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception {
        return send(HttpMethod.PUT, "/api/v1/admin/venues/{id}/availability-rules/weekly",
                merge(body("windows", everyDay("08:00", "14:00")), control), userId, role, tennis);
    }

    @Override
    protected boolean changeApplied() {
        return jdbc.queryForObject("select count(*) from availability_rule where venue_id = ? and rule_type = 'WEEKLY'"
                + " and status = 'ACTIVE' and close_time = '14:00'", Integer.class, tennis) == 7;
    }

    @Override
    protected String expectedAction() {
        return "RULE_WEEKLY_UPDATE";
    }

    @Override
    protected Map<String, Object> invalidField() {
        return body("windows", List.of(body("weekday", 9, "openTime", "08:00", "closeTime", "14:00")));
    }
}
