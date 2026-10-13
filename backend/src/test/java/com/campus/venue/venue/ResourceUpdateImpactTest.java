package com.campus.venue.venue;

import com.campus.venue.support.ImpactContractTests;
import com.campus.venue.user.domain.Role;
import java.util.Map;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

/** BE-2b T2：PATCH /admin/resources/{id} 把场地改为 MAINTENANCE 时的影响检查六条。 */
class ResourceUpdateImpactTest extends ImpactContractTests {

    @Override
    protected MvcResult change(Map<String, Object> control, long userId, Role role) throws Exception {
        return send(HttpMethod.PATCH, "/api/v1/admin/resources/{id}",
                merge(body("operationalStatus", "MAINTENANCE"), control), userId, role, court4);
    }

    @Override
    protected boolean changeApplied() {
        return "MAINTENANCE".equals(resourceStatus(court4));
    }

    @Override
    protected String expectedAction() {
        return "RESOURCE_STATUS_CHANGE";
    }

    @Override
    protected Map<String, Object> invalidField() {
        return body("sortOrder", -1);
    }
}
