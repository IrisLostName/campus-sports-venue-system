package com.campus.venue.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.MappedJwtClaimSetConverter;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** JWT 编解码器：HS256，密钥来自 JWT_SECRET。 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

    @Bean
    public JwtEncoder jwtEncoder(JwtProperties properties) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(properties)));
    }

    /**
     * 解码器只校验签名与结构；去掉框架默认的时间戳校验（它带 60 秒容差且按 now > exp 判定），
     * 过期统一由 TokenService 按注入的 Clock、容差 0、now >= exp 判定（J2）。
     * 框架的默认声明转换在令牌没有 iat 而有 exp 时会补一个 iat（exp 减 1 秒）；这里保留“没有 iat”，
     * 使 TokenService 能按 SEC-2b 裁决 Q2 把它判为 AUTH_REQUIRED，而不是拿一个虚构的签发时刻与 password_changed_at 比较。
     */
    @Bean
    public JwtDecoder jwtDecoder(JwtProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey(properties))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(jwt -> OAuth2TokenValidatorResult.success());
        MappedJwtClaimSetConverter defaults = MappedJwtClaimSetConverter.withDefaults(Collections.emptyMap());
        decoder.setClaimSetConverter(claims -> {
            Map<String, Object> converted = defaults.convert(claims);
            if (claims.containsKey(JwtClaimNames.IAT) || converted == null) {
                return converted;
            }
            Map<String, Object> withoutIssuedAt = new HashMap<>(converted);
            withoutIssuedAt.remove(JwtClaimNames.IAT);
            return withoutIssuedAt;
        });
        return decoder;
    }

    private static SecretKey secretKey(JwtProperties properties) {
        return new SecretKeySpec(properties.secretBytes(), "HmacSHA256");
    }
}
