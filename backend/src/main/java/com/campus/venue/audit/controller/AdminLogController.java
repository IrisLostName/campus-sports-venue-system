package com.campus.venue.audit.controller;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.dto.LogsQuery;
import com.campus.venue.audit.dto.OperationLogView;
import com.campus.venue.audit.service.OperationLogQueryService;
import com.campus.venue.audit.service.OperationLogQueryService.Query;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 管理员操作记录（docs/12 第 5.10 节，BE-6 L1）：VA（范围内）、SA；查询参数校验先于角色检查（方法级注解）。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/logs")
public class AdminLogController {

    private final OperationLogQueryService queryService;

    public AdminLogController(OperationLogQueryService queryService) {
        this.queryService = queryService;
    }

    /** 返回 Page&lt;OperationLog&gt;，按时间倒序。 */
    @GetMapping
    @PreAuthorize("hasAnyRole('VENUE_ADMIN', 'SYS_ADMIN')")
    public PageView<OperationLogView> list(@AuthenticationPrincipal AuthenticatedUser user, @Valid LogsQuery query) {
        LogAction action = query.action() == null ? null : LogAction.valueOf(query.action());
        return queryService.list(user, new Query(query.venueId(), action, query.dateFrom(), query.dateTo(),
                query.pageOrDefault(), query.pageSizeOrDefault()));
    }
}
