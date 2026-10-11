package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 令牌过滤器：只做认证（P1）。公开接口与 CORS 预检完全不读 Authorization 头（J6）；
 * 其余路径：没有该头时交给授权规则（入口点返回 AUTH_REQUIRED），有头但无效、过期、用户不存在或停用时直接写出 ErrorBody。
 * 不注册为 Spring 组件，避免被 Servlet 容器重复注册；由 SecurityConfig 创建。
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final TokenAuthenticator authenticator;
    private final SecurityErrorWriter errorWriter;

    public JwtAuthenticationFilter(TokenAuthenticator authenticator, SecurityErrorWriter errorWriter) {
        this.authenticator = authenticator;
        this.errorWriter = errorWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return PublicEndpoints.MATCHER.matches(request) || CorsUtils.isPreFlightRequest(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null) {
            AuthenticatedUser user;
            try {
                user = authenticator.authenticate(header);
            } catch (BusinessException ex) {
                errorWriter.write(response, ex.getErrorCode());
                return;
            }
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities()));
            SecurityContextHolder.setContext(context);
        }
        chain.doFilter(request, response);
    }
}
