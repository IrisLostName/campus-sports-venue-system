package com.campus.venue.common.validation;

/** 管理员覆盖（取消、资源改派、人员改派，docs/10 第 6 节）的请求体：都带必填的 reason（BE-5 C2）。 */
public interface OverrideReason {

    String reason();
}
