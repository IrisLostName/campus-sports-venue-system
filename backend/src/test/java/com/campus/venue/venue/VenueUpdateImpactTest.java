package com.campus.venue.venue;

import com.campus.venue.support.ImpactContractTests;
import com.campus.venue.user.domain.Role;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-2b T2：PATCH /admin/venues/{id} 把场馆 OPEN 改为 CLOSED 时的影响检查六条（ACC-M3-06 的批量 KEEP/CANCEL 部分，待 BE-5 一并标注）。 */
class VenueUpdateImpactTest extends ImpactContractTests {

    @Override
    protected MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception {
        return send(HttpMethod.PATCH, "/api/v1/admin/venues/{id}", merge(body("operationalStatus", "CLOSED"), control),
                userId, role, tennis);
    }

    @Override
    protected boolean changeApplied() {
        return "CLOSED".equals(jdbc.queryForObject("select operational_status from venue where id = ?", String.class,
                tennis));
    }

    @Override
    protected String expectedAction() {
        return "VENUE_UPDATE";
    }

    @Override
    protected Map<String, Object> invalidField() {
        return body("name", "   ");
    }
}
