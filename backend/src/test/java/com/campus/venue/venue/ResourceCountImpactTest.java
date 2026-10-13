package com.campus.venue.venue;

import com.campus.venue.support.ImpactContractTests;
import com.campus.venue.user.domain.Role;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-2b T2（ACC-M3-08 降低数量时的预检）：PUT /admin/venues/{id}/resource-count 由 4 减为 3 停用网球场4 的影响检查六条。 */
class ResourceCountImpactTest extends ImpactContractTests {

    @Override
    protected MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception {
        return send(HttpMethod.PUT, "/api/v1/admin/venues/{id}/resource-count", merge(body("count", 3), control),
                userId, role, tennis);
    }

    @Override
    protected boolean changeApplied() {
        return "DISABLED".equals(resourceStatus(court4));
    }

    @Override
    protected String expectedAction() {
        return "RESOURCE_COUNT_CHANGE";
    }

    @Override
    protected Map<String, Object> invalidField() {
        return body("count", 51);
    }
}
