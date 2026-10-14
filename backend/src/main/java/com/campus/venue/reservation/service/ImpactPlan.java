package com.campus.venue.reservation.service;

import com.campus.venue.audit.domain.LogAction;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * 一次带影响检查的变更（与 mock impact.ts 的 ImpactPlan 对应）：before 为变更前的对象（调用方在 commit 之前取），
 * action 为 null 表示该变更没有对应的日志枚举值、不写日志；targetId 由变更后的对象给出（新建对象的 id 在 commit 后才知道）；
 * commit 执行变更并返回变更后的对象。
 */
public record ImpactPlan<T>(long venueId, LogAction action, Object before, Function<T, Long> targetId,
        Supplier<T> commit) {
}
