package com.campus.venue.audit.domain;

/** 操作对象类型（docs/12 第 2 节 LogTargetType）。 */
public enum LogTargetType {
    RESERVATION,
    RESOURCE,
    VENUE,
    RULE,
    USER,
    SCOPE,
    ANNOUNCEMENT,
    REPAIR
}
