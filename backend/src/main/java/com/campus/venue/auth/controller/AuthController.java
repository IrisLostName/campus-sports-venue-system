package com.campus.venue.auth.controller;

import com.campus.venue.auth.dto.LoginRequest;
import com.campus.venue.auth.dto.LoginResponse;
import com.campus.venue.auth.dto.RegisterRequest;
import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.auth.service.AuthService;
import com.campus.venue.common.ApiPaths;
import com.campus.venue.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 认证接口（docs/12 第 5.1 节）：注册、登录为公开接口，me 需登录。登出由前端丢弃令牌完成。 */
@RestController
@RequestMapping(ApiPaths.BASE + "/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** 当前用户只取自令牌（V2）。 */
    @GetMapping("/me")
    public UserProfile me(@AuthenticationPrincipal AuthenticatedUser user) {
        return authService.me(user.id());
    }
}
