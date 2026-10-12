package com.campus.venue.security;

import com.campus.venue.common.ApiPaths;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * 公开接口的唯一清单（BE-1 J6）。同一个匹配器既用于 permitAll，也用于令牌过滤器的 shouldNotFilter：
 * 公开接口完全忽略 Authorization 头，带过期或无效令牌也照常返回。以后的公开接口由各自的工作包加入这里。
 */
public final class PublicEndpoints {

    public static final RequestMatcher MATCHER = new OrRequestMatcher(
            match(HttpMethod.POST, ApiPaths.BASE + "/auth/register"),
            match(HttpMethod.POST, ApiPaths.BASE + "/auth/login"),
            match(HttpMethod.GET, ApiPaths.BASE + "/config/booking-rules"),
            match(HttpMethod.GET, "/actuator/health"));

    private PublicEndpoints() {
    }

    private static RequestMatcher match(HttpMethod method, String path) {
        return PathPatternRequestMatcher.withDefaults().matcher(method, path);
    }
}
