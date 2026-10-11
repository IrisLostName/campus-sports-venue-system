package com.campus.venue.security;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.nio.charset.StandardCharsets;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * JWT 配置（BE-1 J1、J2）。JWT_SECRET 没有可用默认值：缺失或少于 32 字节（UTF-8）时绑定校验失败，应用无法启动。
 */
@Validated
@ConfigurationProperties("app.jwt")
public record JwtProperties(String secret, @NotNull @Positive Integer expireHours) {

    static final int MIN_SECRET_BYTES = 32;

    /** 密钥可用：非空且 UTF-8 编码后至少 32 字节。 */
    @AssertTrue(message = "JWT_SECRET 未设置或少于 32 字节（UTF-8）")
    public boolean isSecretUsable() {
        return secret != null && secret.getBytes(StandardCharsets.UTF_8).length >= MIN_SECRET_BYTES;
    }

    byte[] secretBytes() {
        return secret.getBytes(StandardCharsets.UTF_8);
    }

    /** 不在日志或异常信息中输出密钥。 */
    @Override
    public String toString() {
        return "JwtProperties[secret=***, expireHours=" + expireHours + "]";
    }
}
