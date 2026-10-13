package com.campus.venue.availability;

import com.campus.venue.support.ImpactContractTests;
import com.campus.venue.user.domain.Role;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-2b T2：POST /admin/venues/{id}/closures 关闭网球场4 明天一天的影响检查六条（实际执行 201）。 */
class ClosureImpactTest extends ImpactContractTests {

    @Override
    protected MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception {
        return send(HttpMethod.POST, "/api/v1/admin/venues/{id}/closures", merge(body("startDate",
                TOMORROW.toString(), "endDate", TOMORROW.toString(), "resourceId", court4), control),
                userId, role, tennis);
    }

    @Override
    protected boolean changeApplied() {
        return jdbc.queryForObject("select count(*) from availability_rule where venue_id = ? and rule_type = 'CLOSURE'"
                + " and status = 'ACTIVE'", Integer.class, tennis) == 1;
    }

    @Override
    protected String expectedAction() {
        return "CLOSURE_ADD";
    }

    @Override
    protected Map<String, Object> invalidField() {
        return body("startDate", null);
    }

    @Override
    protected int appliedStatus() {
        return 201;
    }
}
