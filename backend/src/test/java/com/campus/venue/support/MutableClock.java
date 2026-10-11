package com.campus.venue.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** 可调的测试时钟：时区固定为 Asia/Shanghai，不依赖真实时间与 JVM 时区（T4）。每个测试前由基类重置。 */
public class MutableClock extends Clock {

    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    /** 默认“现在”：2026-10-12 08:30:15（Asia/Shanghai）。 */
    public static final LocalDateTime START = LocalDateTime.of(2026, 10, 12, 8, 30, 15);

    private volatile Instant now = START.atZone(ZONE).toInstant();

    public void reset() {
        setLocal(START);
    }

    public void setLocal(LocalDateTime local) {
        now = local.atZone(ZONE).toInstant();
    }

    public void set(Instant instant) {
        now = instant;
    }

    public void advance(Duration duration) {
        now = now.plus(duration);
    }

    @Override
    public ZoneId getZone() {
        return ZONE;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return Clock.fixed(now, zone);
    }

    @Override
    public Instant instant() {
        return now;
    }
}
