package com.campus.venue.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/** J1：JWT_SECRET 无默认值；缺失、空串或少于 32 字节（UTF-8）时启动失败并给出明确信息，且不泄露密钥。 */
class JwtPropertiesTest {

    private static final String MESSAGE = "JWT_SECRET 未设置或少于 32 字节（UTF-8）";

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(JwtProperties.class)
    static class PropertiesOnly {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesOnly.class)
            .withPropertyValues("app.jwt.expire-hours=8");

    private static String failureMessages(Throwable failure) {
        StringBuilder messages = new StringBuilder();
        for (Throwable t = failure; t != null; t = t.getCause()) {
            messages.append(t.getMessage()).append('\n');
        }
        return messages.toString();
    }

    @Test
    void missingSecretFailsStartupWithAClearMessage() {
        runner.run(context -> {
            assertThat(context).hasFailed();
            assertThat(failureMessages(context.getStartupFailure())).contains(MESSAGE);
        });
    }

    @Test
    void emptySecretFailsStartup() {
        runner.withPropertyValues("app.jwt.secret=").run(context -> {
            assertThat(context).hasFailed();
            assertThat(failureMessages(context.getStartupFailure())).contains(MESSAGE);
        });
    }

    @Test
    void thirtyOneByteSecretFailsWithoutLeakingIt() {
        String secret = "a".repeat(31);
        runner.withPropertyValues("app.jwt.secret=" + secret).run(context -> {
            assertThat(context).hasFailed();
            String messages = failureMessages(context.getStartupFailure());
            assertThat(messages).contains(MESSAGE).doesNotContain(secret);
        });
    }

    @Test
    void thirtyTwoByteSecretIsAccepted() {
        runner.withPropertyValues("app.jwt.secret=" + "a".repeat(32)).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(JwtProperties.class).expireHours()).isEqualTo(8);
        });
    }

    /** 按 UTF-8 字节计：11 个汉字只有 11 个字符，但有 33 字节，可用；10 个汉字加 1 个字母是 31 字节，不可用。 */
    @Test
    void lengthIsCountedInUtf8Bytes() {
        runner.withPropertyValues("app.jwt.secret=" + "密".repeat(11)).run(context -> assertThat(context).hasNotFailed());
        runner.withPropertyValues("app.jwt.secret=" + "密".repeat(10) + "a")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void nonPositiveExpireHoursFailStartup() {
        runner.withPropertyValues("app.jwt.secret=" + "a".repeat(32), "app.jwt.expire-hours=0")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void toStringNeverContainsTheSecret() {
        String secret = "s".repeat(40);
        assertThat(new JwtProperties(secret, 8).toString()).doesNotContain(secret).contains("***");
    }
}
