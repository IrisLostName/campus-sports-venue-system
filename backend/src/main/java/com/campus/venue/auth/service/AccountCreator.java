package com.campus.venue.auth.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.common.error.UniqueViolations;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.domain.UserType;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 新建账号（自助注册 BE-1 A1 与系统管理员创建账号 BE-6 U2 共用）：用户名预检查、落库字段、唯一冲突翻译只在这里实现一处。
 * 落库：username、displayName 按原值；空白 phone 存 NULL；userType 缺省 STUDENT；状态 ACTIVE；
 * created_at/updated_at 取 Clock 并截断到微秒（K2）。事务由调用方提供。
 */
@Service
public class AccountCreator {

    static final String USERNAME_CONSTRAINT = "uq_app_user_username";

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public AccountCreator(AppUserRepository users, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /** 新账号的内容（已通过字段格式校验）。userType 为 null 表示缺省；phone 可为 null 或空白。 */
    public record NewAccount(String username, String password, String displayName, Role role, String userType,
            String phone) {
    }

    /** 用户名已存在 → USERNAME_TAKEN（区分大小写，与库约束一致）。 */
    public void requireUsernameFree(String username) {
        if (users.existsByUsername(username)) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
    }

    /** 预检查用户名后插入。 */
    public AppUser create(NewAccount account) {
        requireUsernameFree(account.username());
        return insert(account);
    }

    /** 插入并立即刷新；并发插入撞上用户名唯一约束 → USERNAME_TAKEN，其他约束错误照常抛出。 */
    public AppUser insert(NewAccount account) {
        AppUser user = newUser(account);
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            if (isUsernameConflict(ex)) {
                throw new BusinessException(ErrorCode.USERNAME_TAKEN);
            }
            throw ex;
        }
    }

    /** 只有 SQLState 23505 且约束名为 uq_app_user_username 才算用户名冲突，其他约束错误照常抛出。 */
    static boolean isUsernameConflict(DataIntegrityViolationException ex) {
        return UniqueViolations.isViolationOf(ex, USERNAME_CONSTRAINT);
    }

    private AppUser newUser(NewAccount account) {
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        AppUser user = new AppUser();
        user.setUsername(account.username());
        user.setPasswordHash(passwordEncoder.encode(account.password()));
        user.setDisplayName(account.displayName());
        user.setRole(account.role());
        user.setUserType(account.userType() == null ? UserType.STUDENT : UserType.valueOf(account.userType()));
        user.setPhone(account.phone() == null || account.phone().isBlank() ? null : account.phone());
        user.setStatus(AccountStatus.ACTIVE);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return user;
    }
}
