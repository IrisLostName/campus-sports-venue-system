package com.campus.venue.stats.domain;

/** 场地实时状态（docs/12 第 2 节 ResourceLiveState，docs/03 第 4.5 节），只出现在大屏，不落库。 */
public enum ResourceLiveState {
    FREE,
    RESERVED,
    IN_USE,
    MAINTENANCE,
    DISABLED
}
