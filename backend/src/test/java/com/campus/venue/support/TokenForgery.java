package com.campus.venue.support;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** 伪造令牌：用另一把密钥签名、无签名（alg=none）、篡改签名，用于验证 AUTH_REQUIRED 与 J6。 */
public final class TokenForgery {

    private static final String OTHER_SECRET = "another-secret-that-the-server-does-not-know";

    private TokenForgery() {
    }

    /** 结构与真令牌相同、但用服务端不知道的密钥签名。 */
    public static String signedWithOtherSecret(long userId, Instant issuedAt, Instant expiresAt) {
        NimbusJwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<>(
                new SecretKeySpec(OTHER_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
        JwtClaimsSet claims = JwtClaimsSet.builder().subject(Long.toString(userId)).claim("role", "SYS_ADMIN")
                .issuedAt(issuedAt).expiresAt(expiresAt).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    /** 不签名的令牌（alg=none）。 */
    public static String unsigned(long userId, Instant expiresAt) {
        Base64.Encoder base64 = Base64.getUrlEncoder().withoutPadding();
        String header = base64.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        String payload = base64.encodeToString(("{\"sub\":\"" + userId + "\",\"role\":\"SYS_ADMIN\",\"exp\":"
                + expiresAt.getEpochSecond() + "}").getBytes(StandardCharsets.UTF_8));
        return header + "." + payload + ".";
    }

    /**
     * 保留真令牌的载荷，把头部改为另一种 HMAC 算法（如 HS384、HS512）并用给定密钥重新签名（N4）。
     * 直接用 JCA 计算 HMAC：Nimbus 签名器要求密钥长度不短于摘要长度，而测试密钥较短。
     */
    public static String resignedWith(String token, MacAlgorithm algorithm, String secret) {
        Base64.Encoder base64 = Base64.getUrlEncoder().withoutPadding();
        String header = base64.encodeToString(("{\"alg\":\"" + algorithm.getName() + "\"}")
                .getBytes(StandardCharsets.UTF_8));
        String signingInput = header + token.substring(token.indexOf('.'), token.lastIndexOf('.'));
        try {
            Mac mac = Mac.getInstance(algorithm.getName().replace("HS", "HmacSHA"));
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), mac.getAlgorithm()));
            return signingInput + "." + base64.encodeToString(
                    mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII)));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** 改动签名中间的一个字符（不动末位：末位含填充位，改动可能不改变解码结果）。 */
    public static String tamperSignature(String token) {
        int index = token.lastIndexOf('.') + 5;
        char replaced = token.charAt(index) == 'A' ? 'Q' : 'A';
        return token.substring(0, index) + replaced + token.substring(index + 1);
    }
}
