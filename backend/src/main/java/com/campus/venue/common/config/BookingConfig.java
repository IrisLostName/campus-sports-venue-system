package com.campus.venue.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** 启用预约参数的绑定与校验。 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(BookingProperties.class)
public class BookingConfig {
}
