package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import java.util.Optional;
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
        return find().orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
    }

    /** 当前已认证用户；未认证时为空，不抛异常（供格式阶段的校验器使用，P2-2b）。 */
    public Optional<AuthenticatedUser> find() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
