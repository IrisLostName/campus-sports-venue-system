package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import org.springframework.stereotype.Component;

/**
 * 把 Authorization 头解析为当前用户（J4、J5）：每次请求都按令牌中的用户 id 查库，
 * 查不到 → AUTH_REQUIRED；已停用 → ACCOUNT_DISABLED；角色取库中的当前值。
 */
@Component
public class TokenAuthenticator {

    private static final String BEARER = "Bearer ";

    private final TokenService tokenService;
    private final AppUserRepository users;

    public TokenAuthenticator(TokenService tokenService, AppUserRepository users) {
        this.tokenService = tokenService;
        this.users = users;
    }

    public AuthenticatedUser authenticate(String authorizationHeader) {
        long userId = tokenService.verify(extractToken(authorizationHeader));
        AppUser user = users.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        if (user.getStatus() == AccountStatus.DISABLED) {
            throw new BusinessException(ErrorCode.ACCOUNT_DISABLED);
        }
        return new AuthenticatedUser(user.getId(), user.getUsername(), user.getRole());
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
