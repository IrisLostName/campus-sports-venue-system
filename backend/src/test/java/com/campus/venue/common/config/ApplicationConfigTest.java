package com.campus.venue.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.FileSystemResource;

/** C1、C5：application.yml 的环境变量键、默认值规则与关键配置。 */
class ApplicationConfigTest {

    private static final Path YAML = Path.of("src", "main", "resources", "application.yml");

    private static Properties load() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new FileSystemResource(YAML));
        return factory.getObject();
    }

    /** BE-1 裁决第 12 节：机密没有可用默认值；JWT_SECRET 只以空默认值绑定到 app.jwt.secret。 */
    @Test
    void secretsHaveNoUsableDefault() throws Exception {
        Properties props = load();
        String raw = Files.readString(YAML, StandardCharsets.UTF_8);

        assertThat(props.getProperty("spring.datasource.password")).isEqualTo("${DB_PASSWORD}");
        assertThat(props.stringPropertyNames()).filteredOn(name -> name.toLowerCase().contains("secret"))
                .containsExactly("app.jwt.secret");
        assertThat(props.getProperty("app.jwt.secret")).isEqualTo("${JWT_SECRET:}");
        assertThat(raw).containsOnlyOnce("${JWT_SECRET");
    }

    @Test
    void nonSecretVariablesCarryTheDocumentedDefaults() {
        Properties props = load();

        assertThat(props.getProperty("server.port")).isEqualTo("${SERVER_PORT:8080}");
        assertThat(props.getProperty("spring.datasource.username")).isEqualTo("${DB_USERNAME:venue}");
        assertThat(props.getProperty("app.timezone")).isEqualTo("${APP_TIMEZONE:Asia/Shanghai}");
        assertThat(props.getProperty("app.cors.allowed-origins"))
                .isEqualTo("${CORS_ALLOWED_ORIGINS:http://localhost:5173}");
        assertThat(props.getProperty("app.jwt.expire-hours")).isEqualTo("${JWT_EXPIRE_HOURS:8}");
        assertThat(props.getProperty("app.booking.advance-days")).isEqualTo("${BOOKING_ADVANCE_DAYS:7}");
        assertThat(props.getProperty("app.booking.cancel-deadline-minutes"))
                .isEqualTo("${BOOKING_CANCEL_DEADLINE_MINUTES:120}");
        assertThat(props.getProperty("app.booking.checkin-open-before-minutes"))
                .isEqualTo("${BOOKING_CHECKIN_OPEN_BEFORE_MINUTES:15}");
        assertThat(props.getProperty("app.booking.checkin-close-after-minutes"))
                .isEqualTo("${BOOKING_CHECKIN_CLOSE_AFTER_MINUTES:15}");
        assertThat(props.getProperty("app.booking.checkout-grace-minutes"))
                .isEqualTo("${BOOKING_CHECKOUT_GRACE_MINUTES:30}");
        assertThat(props.getProperty("app.booking.max-active-per-user"))
                .isEqualTo("${BOOKING_MAX_ACTIVE_PER_USER:3}");
    }

    @Test
    void jpaFlywayAndErrorSettingsFollowTheRulings() {
        Properties props = load();

        assertThat(props.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(props.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
        assertThat(props.getProperty("spring.flyway.locations")).isEqualTo("classpath:db/migration");
        assertThat(props.getProperty("spring.flyway.clean-disabled")).isEqualTo("true");
        assertThat(props.getProperty("server.error.include-stacktrace")).isEqualTo("never");
        assertThat(props.getProperty("management.endpoints.web.exposure.include")).isEqualTo("health");
        assertThat(props.getProperty("management.endpoint.health.show-details")).isEqualTo("never");
    }

    @Test
    void demoProfileAppendsTheSeedLocation() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new FileSystemResource(Path.of("src", "main", "resources", "application-demo.yml")));

        assertThat(factory.getObject().getProperty("spring.flyway.locations"))
                .isEqualTo("classpath:db/migration,classpath:db/demo");
    }
}
