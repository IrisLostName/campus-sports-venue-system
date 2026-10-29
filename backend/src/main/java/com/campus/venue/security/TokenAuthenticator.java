package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

/**
 * 把 Authorization 头解析为当前用户（J4、J5）：每次请求都按令牌中的用户 id 查库，
 * 查不到 → AUTH_REQUIRED；签发早于该账号的 password_changed_at → TOKEN_EXPIRED（v1.3，SEC-2b）；
 * 已停用 → ACCOUNT_DISABLED；角色取库中的当前值。
 */
@Component
public class TokenAuthenticator {

    private static final String BEARER = "Bearer ";

    private final TokenService tokenService;
    private final AppUserRepository users;
    private final Clock clock;

    public TokenAuthenticator(TokenService tokenService, AppUserRepository users, Clock clock) {
        this.tokenService = tokenService;
        this.users = users;
        this.clock = clock;
    }

    public AuthenticatedUser authenticate(String authorizationHeader) {
        VerifiedToken token = tokenService.verifyToken(extractToken(authorizationHeader));
        AppUser user = users.findById(token.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        if (issuedBeforePasswordChange(token, user.getPasswordChangedAt())) {
            throw new BusinessException(ErrorCode.TOKEN_EXPIRED);
        }
        if (user.getStatus() == AccountStatus.DISABLED) {
            throw new BusinessException(ErrorCode.ACCOUNT_DISABLED);
        }
        return new AuthenticatedUser(user.getId(), user.getUsername(), user.getRole());
    }

    /**
     * 令牌签发于最近一次自助找回密码之前（SEC-2b 裁决第 4 条）：changedAt 为空表示从未重置。两者都截到整秒，
     * 所以重置后同一秒内重新登录得到的令牌（iat 等于 changedAt）有效；代价是同一秒内、重置之前签发的令牌也仍有效。
     * changedAt 是 APP_TIMEZONE 下的本地时间，按 Clock 的时区换算为时刻再比较。先于停用检查（裁决 Q3）。
     */
    private boolean issuedBeforePasswordChange(VerifiedToken token, LocalDateTime changedAt) {
        return changedAt != null && token.issuedAt().isBefore(changedAt.atZone(clock.getZone()).toInstant());
    }

    /** 只接受 “Bearer 令牌” 形式（方案名不区分大小写、令牌非空），否则 AUTH_REQUIRED。 */
    private static String extractToken(String header) {
        if (header.length() <= BEARER.length() || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            throw new BusinessException(ErrorCode.AUTH_REQUIRED);
        }
        String token = header.substring(BEARER.length()).trim();
        if (token.isEmpty()) {
            throw new BusinessException(ErrorCode.AUTH_REQUIRED);
        }
        return token;
    }
}
