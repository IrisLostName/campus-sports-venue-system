package com.campus.venue.security;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.Role;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

/**
 * 令牌签发与校验（BE-1 J2、J3、J5）。“现在”一律取注入的 Clock；时钟容差为 0，now >= exp 即过期。
 * 令牌只含 sub（用户 id）、role、iat、exp，不含授权场馆。
 */
@Component
public class TokenService {

    static final String ROLE_CLAIM = "role";

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final Clock clock;
    private final Duration lifetime;

    public TokenService(JwtEncoder encoder, JwtDecoder decoder, Clock clock, JwtProperties properties) {
        this.encoder = encoder;
        this.decoder = decoder;
        this.clock = clock;
        this.lifetime = Duration.ofHours(properties.expireHours());
    }

    /** 为用户签发令牌；签发时刻截到整秒，使 expiresAt 与 exp 完全一致。 */
    public IssuedToken issue(long userId, Role role) {
        Instant issuedAt = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = issuedAt.plus(lifetime);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(Long.toString(userId))
                .claim(ROLE_CLAIM, role.name())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, LocalDateTime.ofInstant(expiresAt, clock.getZone()));
    }

    /**
     * 校验令牌并返回用户 id。先验签名：签名不符、无法解析、缺少 exp 或 sub 非数字 → AUTH_REQUIRED；
     * 签名有效但 now >= exp → TOKEN_EXPIRED。
     */
    public long verify(String token) {
        Jwt jwt;
        try {
            jwt = decoder.decode(token);
        } catch (JwtException ex) {
            throw new BusinessException(ErrorCode.AUTH_REQUIRED);
        }
        Instant expiresAt = jwt.getExpiresAt();
        Long userId = parseUserId(jwt.getSubject());
        if (expiresAt == null || userId == null) {
            throw new BusinessException(ErrorCode.AUTH_REQUIRED);
        }
        if (!clock.instant().isBefore(expiresAt)) {
            throw new BusinessException(ErrorCode.TOKEN_EXPIRED);
        }
        return userId;
    }

    private static Long parseUserId(String subject) {
        if (subject == null) {
            return null;
        }
        try {
            return Long.valueOf(subject);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
