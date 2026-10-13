package com.campus.venue.common.validation;

/**
 * 影响检查的控制字段（docs/12 第 5.5 节“影响检查”，BE-2b 裁决 I1）：五个影响检查接口的请求体都实现它。
 * onExistingReservations 取 KEEP/CANCEL（可空）；reason ≤ 200（可空）；dryRun 可空，缺省视为 false。
 */
public interface ImpactControl {

    String KEEP = "KEEP";
    String CANCEL = "CANCEL";

    String onExistingReservations();

    String reason();

    Boolean dryRun();

    default boolean dryRunRequested() {
        return Boolean.TRUE.equals(dryRun());
    }

    default boolean cancelRequested() {
        return CANCEL.equals(onExistingReservations());
    }

    /** 空白原因视为未填（BE-2b 裁决第 9 节第 2 条）。 */
    default String reasonOrNull() {
        String reason = reason();
        return reason == null || reason.isBlank() ? null : reason;
    }
}
