package com.campus.venue.reservation.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 每分钟触发一次预约清扫（docs/10 第 8 节，BE-4 W1、W4）。app.sweep.enabled=false 时不创建（测试配置关闭，
 * 避免定时任务在测试中途改动数据）；清扫逻辑在 ReservationSweepService，测试直接调用它。
 */
@Component
@ConditionalOnProperty(prefix = "app.sweep", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReservationSweepJob {

    private final ReservationSweepService sweepService;

    public ReservationSweepJob(ReservationSweepService sweepService) {
        this.sweepService = sweepService;
    }

    /** 每分钟第 0 秒运行。 */
    @Scheduled(cron = "0 * * * * *")
    public void run() {
        sweepService.sweep();
    }
}
