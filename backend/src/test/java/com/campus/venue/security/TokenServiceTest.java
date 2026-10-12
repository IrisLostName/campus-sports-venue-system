package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.support.MutableClock;
import com.campus.venue.support.TokenForgery;
import com.campus.venue.user.domain.Role;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

/** J2、J3、J5：令牌内容、有效期、过期边界（容差 0、now >= exp 即过期）与签名校验；时钟可调，不依赖 JVM 时区。 */
class TokenServiceTest {

    private static final String SECRET = "unit-test-only-secret-0123456789abcdef";

    private final JwtConfig config = new JwtConfig();

    private TokenService service(Clock clock, int expireHours) {
        JwtProperties properties = new JwtProperties(SECRET, expireHours);
        return new TokenService(config.jwtEncoder(properties), config.jwtDecoder(properties), clock, properties);
    }

    private JwtDecoder decoder() {
        return config.jwtDecoder(new JwtProperties(SECRET, 8));
    }

    private static void assertFails(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode()).isEqualTo(code));
    }

    @Test
    void tokenCarriesOnlySubjectRoleIssuedAtAndExpiry() {
        MutableClock clock = new MutableClock();
        IssuedToken issued = service(clock, 8).issue(42L, Role.VENUE_ADMIN);

        Jwt jwt = decoder().decode(issued.token());
        assertThat(jwt.getClaims()).containsOnlyKeys("sub", "role", "iat", "exp");
        assertThat(jwt.getSubject()).isEqualTo("42");
        assertThat(jwt.getClaimAsString("role")).isEqualTo("VENUE_ADMIN");
        assertThat(jwt.getHeaders()).containsEntry("alg", "HS256");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(8));
    }

    /** J3：expiresAt 是 APP_TIMEZONE 下与 exp 同一时刻的本地时间；签发时刻截到整秒。 */
    @Test
    void expiresAtIsTheLocalTimeOfExpInTheClockZone() {
        MutableClock clock = new MutableClock();
        clock.advance(Duration.ofMillis(789));
        IssuedToken issued = service(clock, 8).issue(1L, Role.USER);

        assertThat(issued.expiresAt()).isEqualTo(LocalDateTime.of(2026, 10, 12, 16, 30, 15));
        Instant exp = decoder().decode(issued.token()).getExpiresAt();
        assertThat(LocalDateTime.ofInstant(exp, MutableClock.ZONE)).isEqualTo(issued.expiresAt());
    }

    @Test
    void expiresAtFollowsTheZoneOfTheInjectedClockNotTheJvm() {
        Instant now = Instant.parse("2026-10-12T00:30:15Z");
        IssuedToken issued = service(Clock.fixed(now, ZoneId.of("America/New_York")), 8).issue(1L, Role.USER);

        assertThat(issued.expiresAt()).isEqualTo(LocalDateTime.of(2026, 10, 12, 4, 30, 15));
    }

    @Test
    void expireHoursAreConfigurable() {
        MutableClock clock = new MutableClock();
        IssuedToken issued = service(clock, 2).issue(1L, Role.USER);

        assertThat(issued.expiresAt()).isEqualTo(MutableClock.START.plusHours(2));
    }

    @Test
    void validUntilOneSecondBeforeExpiryAndExpiredExactlyAtExpiry() {
        MutableClock clock = new MutableClock();
        TokenService service = service(clock, 8);
        String token = service.issue(7L, Role.USER).token();

        clock.setLocal(MutableClock.START.plusHours(8).minusSeconds(1));
        assertThat(service.verify(token)).isEqualTo(7L);

        clock.setLocal(MutableClock.START.plusHours(8));
        assertFails(() -> service.verify(token), ErrorCode.TOKEN_EXPIRED);

        clock.setLocal(MutableClock.START.plusDays(3));
        assertFails(() -> service.verify(token), ErrorCode.TOKEN_EXPIRED);
    }

    @Test
    void tamperedSignatureIsAuthRequired() {
        MutableClock clock = new MutableClock();
        TokenService service = service(clock, 8);
        String token = service.issue(7L, Role.USER).token();

        assertFails(() -> service.verify(TokenForgery.tamperSignature(token)), ErrorCode.AUTH_REQUIRED);
    }

    /** 先验签名：伪造且已过期的令牌是 AUTH_REQUIRED，不是 TOKEN_EXPIRED。 */
    @Test
    void foreignSignatureIsAuthRequiredEvenWhenExpired() {
        MutableClock clock = new MutableClock();
        Instant now = clock.instant();
        TokenService service = service(clock, 8);

        assertFails(() -> service.verify(TokenForgery.signedWithOtherSecret(7L, now, now.plusSeconds(60))),
                ErrorCode.AUTH_REQUIRED);
        assertFails(() -> service.verify(TokenForgery.signedWithOtherSecret(7L, now.minusSeconds(120),
                now.minusSeconds(60))), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void unsignedAndMalformedTokensAreAuthRequired() {
        MutableClock clock = new MutableClock();
        TokenService service = service(clock, 8);

        assertFails(() -> service.verify(TokenForgery.unsigned(7L, clock.instant().plusSeconds(3600))),
                ErrorCode.AUTH_REQUIRED);
        assertFails(() -> service.verify("not-a-jwt"), ErrorCode.AUTH_REQUIRED);
        assertFails(() -> service.verify("a.b.c"), ErrorCode.AUTH_REQUIRED);
    }

    @Test
    void validSignatureWithoutExpiryOrWithNonNumericSubjectIsAuthRequired() {
        MutableClock clock = new MutableClock();
        TokenService service = service(clock, 8);
        JwtProperties properties = new JwtProperties(SECRET, 8);
        JwtEncoder encoder = config.jwtEncoder(properties);
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();

        String noExpiry = encoder.encode(JwtEncoderParameters.from(header,
                JwtClaimsSet.builder().subject("7").build())).getTokenValue();
        String textSubject = encoder.encode(JwtEncoderParameters.from(header,
                JwtClaimsSet.builder().subject("zhangsan")
                        .expiresAt(clock.instant().plusSeconds(3600)).build())).getTokenValue();

        assertFails(() -> service.verify(noExpiry), ErrorCode.AUTH_REQUIRED);
        assertFails(() -> service.verify(textSubject), ErrorCode.AUTH_REQUIRED);
    }
}
