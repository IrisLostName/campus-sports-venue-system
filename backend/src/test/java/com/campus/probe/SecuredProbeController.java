package com.campus.probe;

import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅测试用的安全探针：带角色注解的接口（FORBIDDEN、阶段顺序 P1）、当前用户（J4、V2）、
 * 以及直接抛出安全异常（P2 的 MVC 映射）。不在应用组件扫描范围内，由测试显式 @Import。
 */
@RestController
public class SecuredProbeController {

    /** 带校验的请求体。 */
    public record NameBody(@NotBlank String name) {
    }

    private final CurrentUser currentUser;

    public SecuredProbeController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @PreAuthorize("hasRole('SYS_ADMIN')")
    @GetMapping("/api/v1/probe/sys-admin")
    public String sysAdminOnly() {
        return "ok";
    }

    @PreAuthorize("hasRole('SYS_ADMIN')")
    @PostMapping("/api/v1/probe/sys-admin")
    public String sysAdminWithBody(@Valid @RequestBody NameBody body) {
        return body.name();
    }

    @GetMapping("/api/v1/probe/principal")
    public Map<String, Object> principal(@AuthenticationPrincipal AuthenticatedUser user) {
        return Map.of("id", user.id(), "username", user.username(), "role", user.role().name());
    }

    @GetMapping("/api/v1/probe/access-denied")
    public String accessDenied() {
        throw new AccessDeniedException("probe");
    }

    @GetMapping("/api/v1/probe/authentication-failed")
    public String authenticationFailed() {
        throw new BadCredentialsException("probe");
    }

    /** 供 CurrentUser 测试：只从安全上下文取当前用户，忽略请求参数里的 userId（V2）。 */
    @GetMapping("/api/v1/probe/current-user")
    public long currentUser() {
        return currentUser.require().id();
    }
}
