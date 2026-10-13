package com.campus.venue.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.reservation.service.DemoReservationSeeder;
import com.campus.venue.support.AbstractApiTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

/** R2：非 demo profile 下 DemoReservationSeeder 不存在，启动后不会有演示预约。 */
class DemoReservationSeederProfileTest extends AbstractApiTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void seederIsNotActiveOutsideTheDemoProfile() {
        assertThat(context.getBeanNamesForType(DemoReservationSeeder.class)).isEmpty();
        assertThat(context.getEnvironment().getActiveProfiles()).containsExactly("test");
    }
}
