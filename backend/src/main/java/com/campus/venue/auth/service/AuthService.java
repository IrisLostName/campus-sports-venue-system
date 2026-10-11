package com.campus.venue.auth.service;

import com.campus.venue.auth.dto.LoginRequest;
import com.campus.venue.auth.dto.LoginResponse;
import com.campus.venue.auth.dto.RegisterRequest;
import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.security.IssuedToken;
import com.campus.venue.security.TokenService;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.domain.UserType;
import com.campus.venue.user.repository.AppUserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 注册、登录与当前用户（BE-1 A1–A3）。 */
@Service
public class AuthService {

    /** BCrypt 只处理前 72 字节。 */
    static final int BCRYPT_MAX_BYTES = 72;
    static final String USERNAME_CONSTRAINT = "uq_app_user_username";
    private static final String UNIQUE_VIOLATION = "23505";

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final VenueScopeGuard venueScopeGuard;
    private final Clock clock;

    public AuthService(AppUserRepository users, PasswordEncoder passwordEncoder, TokenService tokenService,
            VenueScopeGuard venueScopeGuard, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.venueScopeGuard = venueScopeGuard;
        this.clock = clock;
    }

    /**
     * 自助注册：角色强制 USER、状态 ACTIVE；username、displayName 按原值保存；空白 phone 存 NULL；
     * 时间戳取 Clock（K2）。用户名已存在或并发插入撞唯一约束 → USERNAME_TAKEN。
     */
    @Transactional
    public LoginResponse register(RegisterRequest request) {
        if (users.existsByUsername(request.username())) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }
        AppUser user = newUser(request);
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            if (isUsernameConflict(ex)) {
                throw new BusinessException(ErrorCode.USERNAME_TAKEN);
            }
            throw ex;
        }
        return loginResponse(user);
    }

    /**
     * 登录：先验口令、后看状态（与前端 mock 一致）。用户不存在或口令不符 → INVALID_CREDENTIALS（不区分）；
     * 口令超过 72 字节时不调用编码器，直接 INVALID_CREDENTIALS；口令正确但已停用 → ACCOUNT_DISABLED。
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        if (request.password().getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }
        AppUser user = users.findByUsername(request.username())
                .filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
                .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));
        if (user.getStatus() == AccountStatus.DISABLED) {
            throw new BusinessException(ErrorCode.ACCOUNT_DISABLED);
        }
        return loginResponse(user);
    }

    /** 当前用户资料；用户已不存在 → AUTH_REQUIRED。 */
    @Transactional(readOnly = true)
    public UserProfile me(long userId) {
        AppUser user = users.findById(userId).orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        return profile(user);
    }

    private AppUser newUser(RegisterRequest request) {
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
        AppUser user = new AppUser();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user.setRole(Role.USER);
        user.setUserType(request.userType() == null ? UserType.STUDENT : UserType.valueOf(request.userType()));
        user.setPhone(request.phone() == null || request.phone().isBlank() ? null : request.phone());
        user.setStatus(AccountStatus.ACTIVE);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return user;
    }

    private LoginResponse loginResponse(AppUser user) {
        IssuedToken token = tokenService.issue(user.getId(), user.getRole());
        return new LoginResponse(token.token(), token.expiresAt(), profile(user));
    }

    private UserProfile profile(AppUser user) {
        List<Long> venueIds = user.getRole() == Role.VENUE_ADMIN
                ? venueScopeGuard.effectiveVenueIds(user.getId())
                : null;
        return UserProfileMapper.toProfile(user, venueIds);
    }

    /** 只有 SQLState 23505 且约束名为 uq_app_user_username 才算用户名冲突，其他约束错误照常抛出。 */
    static boolean isUsernameConflict(DataIntegrityViolationException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return UNIQUE_VIOLATION.equals(violation.getSQLState())
                        && USERNAME_CONSTRAINT.equals(violation.getConstraintName());
            }
        }
        return false;
    }
}
