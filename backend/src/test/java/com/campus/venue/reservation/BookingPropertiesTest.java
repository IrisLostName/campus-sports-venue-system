package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.common.config.BookingProperties;
import com.campus.venue.reservation.dto.BookingRules;
import com.campus.venue.reservation.service.BookingRulesService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/** A4：预约参数取自配置、slotMinutes 固定 90；参数须为正整数，非法时启动失败。 */
class BookingPropertiesTest {

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(BookingProperties.class)
    static class PropertiesOnly {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PropertiesOnly.class)
            .withPropertyValues("app.booking.advance-days=7", "app.booking.cancel-deadline-minutes=120",
                    "app.booking.checkin-open-before-minutes=15", "app.booking.checkin-close-after-minutes=15",
                    "app.booking.checkout-grace-minutes=30", "app.booking.max-active-per-user=3");

    @Test
    void configuredValuesAreReportedAndSlotMinutesStaysNinety() {
        runner.withPropertyValues("app.booking.advance-days=14", "app.booking.max-active-per-user=5",
                "app.booking.cancel-deadline-minutes=60").run(context -> {
                    BookingRules rules = new BookingRulesService(context.getBean(BookingProperties.class),
                            "Asia/Tokyo").rules();

                    assertThat(rules).isEqualTo(new BookingRules(90, 14, 60, 15, 15, 30, 5, "Asia/Tokyo"));
                });
    }

    @Test
    void zeroNegativeMissingOrNonNumericValuesFailStartup() {
        runner.withPropertyValues("app.booking.advance-days=0").run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("app.booking.checkout-grace-minutes=-1")
                .run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("app.booking.max-active-per-user=")
                .run(context -> assertThat(context).hasFailed());
        runner.withPropertyValues("app.booking.checkin-open-before-minutes=abc")
                .run(context -> assertThat(context).hasFailed());
        runner.run(context -> assertThat(context).hasNotFailed());
    }
}
