package com.campus.venue.user.controller;

import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.dto.AdminUsersQuery;
import com.campus.venue.user.dto.CreateUserRequest;
import com.campus.venue.user.dto.UpdateUserRequest;
import com.campus.venue.user.service.UserAdminService;
import com.campus.venue.user.service.UserQueryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 系统管理员：用户与授权（docs/12 第 5.9 节，BE-6 U1–U4）。全部仅 SYS_ADMIN；角色用方法级注解，
 * 使查询参数与请求体校验先于角色检查（BE-6 C1）。
 */
@RestController
@RequestMapping(ApiPaths.BASE + "/admin/users")
public class AdminUserController {

    private final UserQueryService userQueryService;
    private final UserAdminService userAdminService;

    public AdminUserController(UserQueryService userQueryService, UserAdminService userAdminService) {
        this.userQueryService = userQueryService;
        this.userAdminService = userAdminService;
    }

    /** U1：返回 Page&lt;UserProfile&gt;（VENUE_ADMIN 含 venueIds）。 */
    @GetMapping
    @PreAuthorize("hasRole('SYS_ADMIN')")
    public PageView<UserProfile> list(@Valid AdminUsersQuery query) {
        Role role = query.role() == null ? null : Role.valueOf(query.role());
        return userQueryService.list(role, query.keyword(), query.pageOrDefault(), query.pageSizeOrDefault());
    }

    /** U2：创建账号（任意角色），返回 201 UserProfile。 */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('SYS_ADMIN')")
    public UserProfile create(@AuthenticationPrincipal AuthenticatedUser admin,
            @Valid @RequestBody CreateUserRequest request) {
        return userAdminService.create(admin, request);
    }

    /** U3：修改姓名或状态，返回更新后的 UserProfile。 */
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SYS_ADMIN')")
    public UserProfile update(@AuthenticationPrincipal AuthenticatedUser admin, @PathVariable long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return userAdminService.update(admin, id, request);
    }
}
