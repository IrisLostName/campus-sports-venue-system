package com.campus.venue.common.validation;

/**
 * 校验分组：REASON_REQUIRED 检查。请求体用 @GroupSequence 把它排在字段格式检查之后，
 * 于是字段格式错误时不再检查原因（BE-2b 裁决 I2：格式 → REASON_REQUIRED → 角色）。
 */
public interface ReasonCheck {
}
