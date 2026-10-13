package com.campus.venue.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 启用定时任务（BE-4 W1）。具体任务（如每分钟的预约清扫）各自可按配置关闭。 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
public class SchedulingConfig {
}
