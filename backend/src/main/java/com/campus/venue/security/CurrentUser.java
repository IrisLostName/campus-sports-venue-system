package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * 取得当前用户（V2）：只从安全上下文取，不信任请求体或参数里的 userId、role（docs/08 第 3 节）。
 * Controller 也可直接用 @AuthenticationPrincipal AuthenticatedUser。
 */
@Component
public class CurrentUser {

    /** 当前已认证用户；未认证时抛 AUTH_REQUIRED。 */
    public AuthenticatedUser require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        throw new BusinessException(ErrorCode.AUTH_REQUIRED);
    }
}
