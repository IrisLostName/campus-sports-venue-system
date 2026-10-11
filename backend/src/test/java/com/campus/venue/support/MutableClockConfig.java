package com.campus.venue.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** 用可调时钟替代应用的 Clock（@Primary），签发与校验令牌、“今天”都取它。 */
@TestConfiguration(proxyBeanMethods = false)
public class MutableClockConfig {

    @Bean
    @Primary
    public MutableClock mutableClock() {
        return new MutableClock();
    }
}
