package com.campus.venue.user.service;

import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.service.OperationLogWriter;
import com.campus.venue.audit.service.VenueScopeReplacer;
import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.auth.service.AccountCreator;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.dto.CreateUserRequest;
import com.campus.venue.user.dto.UpdateUserRequest;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 系统管理员创建与修改账号（docs/12 第 5.9 节，BE-6 U2、U3），与 mock userService.ts 的 createUser、updateUser 一致。
 * 格式与角色（SA）在控制器完成。加锁：只锁目标用户行（加锁顺序 用户行 → 场馆行 → 预约行，BE-2b G8）。
 */
@Service
public class UserAdminService {

    private final AppUserRepository users;
    private final AccountCreator accountCreator;
    private final VenueScopeReplacer scopeReplacer;
    private final UserProfiles profiles;
    private final OperationLogWriter logWriter;
    private final Clock clock;

    public UserAdminService(AppUserRepository users, AccountCreator accountCreator, VenueScopeReplacer scopeReplacer,
            UserProfiles profiles, OperationLogWriter logWriter, Clock clock) {
        this.users = users;
        this.accountCreator = accountCreator;
        this.scopeReplacer = scopeReplacer;
        this.profiles = profiles;
        this.logWriter = logWriter;
        this.clock = clock;
    }

    /**
     * U2：USERNAME_TAKEN（预检查）→ venueIds 中有不存在的场馆 → VALIDATION_ERROR fields.venueIds（角色之后，因为要查库）
     * → 插入（并发唯一冲突也是 USERNAME_TAKEN）→ 仅 VENUE_ADMIN 写入授权（其他角色忽略 venueIds，但仍做存在性检查）
     * → 写 USER_CREATE（before 为 null）。
     */
    @Transactional
    public UserProfile create(AuthenticatedUser admin, CreateUserRequest request) {
        accountCreator.requireUsernameFree(request.username());
        List<Long> venueIds = request.venueIds() == null ? List.of() : request.venueIds();
        scopeReplacer.requireExistingVenues(venueIds);
        Role role = Role.valueOf(request.role());
        AppUser user = accountCreator.insert(new AccountCreator.NewAccount(request.username(), request.password(),
                request.displayName(), role, request.userType(), request.phone()));
        if (role == Role.VENUE_ADMIN && !venueIds.isEmpty()) {
            scopeReplacer.replace(user.getId(), venueIds, admin.id());
        }
        UserProfile created = profiles.of(user);
        logWriter.write(new OperationLogWriter.Entry(admin.id(), null, LogAction.USER_CREATE, user.getId(), null,
                null, created, List.of()));
        return created;
    }

    /**
     * U3：锁定目标用户行 → NOT_FOUND → 把自己置 DISABLED → INVALID_STATE {status: 当前状态} → 执行。
     * 有字段真正改变时 updated_at 取 Clock；只有状态改变时写 USER_STATUS_CHANGE（只改姓名没有对应日志动作）。
     * 停用后其令牌在下一次请求即得 ACCOUNT_DISABLED（认证过滤器每次查库）；已有预约不受影响（API-SYNC）。
     */
    @Transactional
    public UserProfile update(AuthenticatedUser admin, long id, UpdateUserRequest request) {
        AppUser user = users.lockById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        AccountStatus status = request.status() == null ? null : AccountStatus.valueOf(request.status());
        if (status == AccountStatus.DISABLED && user.getId() == admin.id()) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", user.getStatus().name()));
        }
        UserProfile before = profiles.of(user);
        boolean statusChanged = status != null && status != user.getStatus();
        if (!apply(user, status, request.displayName())) {
            return before;
        }
        users.saveAndFlush(user);
        UserProfile after = profiles.of(user);
        if (statusChanged) {
            logWriter.write(new OperationLogWriter.Entry(admin.id(), null, LogAction.USER_STATUS_CHANGE,
                    user.getId(), null, before, after, List.of()));
        }
        return after;
    }

    /**
     * U4：锁定目标用户行（使同一管理员的整体替换与 PATCH 串行）→ NOT_FOUND → 目标不是 VENUE_ADMIN →
     * INVALID_STATE {status: 目标角色} → 有不存在的场馆 → VALIDATION_ERROR fields.venueIds → 整体替换
     * （算法见 VenueScopeReplacer）。每次调用都写 SCOPE_UPDATE（含无变化的替换，与 mock 一致）。
     * 撤销后该管理员的下一次请求即得 FORBIDDEN_SCOPE（授权每次查库，ACC-M3-07）。
     */
    @Transactional
    public UserProfile replaceVenueScope(AuthenticatedUser admin, long id, List<Long> venueIds) {
        AppUser user = users.lockById(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (user.getRole() != Role.VENUE_ADMIN) {
            throw new BusinessException(ErrorCode.INVALID_STATE, Map.of("status", user.getRole().name()));
        }
        scopeReplacer.requireExistingVenues(venueIds);
        UserProfile before = profiles.of(user);
        scopeReplacer.replace(user.getId(), venueIds, admin.id());
        UserProfile after = profiles.of(user);
        logWriter.write(new OperationLogWriter.Entry(admin.id(), null, LogAction.SCOPE_UPDATE, user.getId(), null,
                before, after, List.of()));
        return after;
    }

    /** 把真正改变的字段写入实体；有改变时 updated_at 取 Clock。返回是否有改变（null 视为未给）。 */
    private boolean apply(AppUser user, AccountStatus status, String displayName) {
        boolean changed = false;
        if (status != null && status != user.getStatus()) {
            user.setStatus(status);
            changed = true;
        }
        if (displayName != null && !displayName.equals(user.getDisplayName())) {
            user.setDisplayName(displayName);
            changed = true;
        }
        if (changed) {
            user.setUpdatedAt(LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS));
        }
        return changed;
    }
}
