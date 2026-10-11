package com.campus.venue.common.error;

import org.springframework.http.HttpStatus;

/**
 * 错误码枚举，与 docs/12 第 3 节表格逐行一致（29 个）。
 * 默认文案取表格第三列原文；仅 RULE_INVALID 与 HAS_HISTORY 按 BE-0 裁决 R1 取简化文案。
 */
public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "请求参数不合法"),
    RULE_INVALID(HttpStatus.BAD_REQUEST, "开放规则不合法"),
    DATE_OUT_OF_RANGE(HttpStatus.BAD_REQUEST, "超出可预约日期范围"),
    AUTH_REQUIRED(HttpStatus.UNAUTHORIZED, "请先登录"),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "登录已过期，请重新登录"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "用户名或密码错误"),
    ACCOUNT_DISABLED(HttpStatus.FORBIDDEN, "账号已停用"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "无权执行此操作"),
    FORBIDDEN_SCOPE(HttpStatus.FORBIDDEN, "无权操作该场馆"),
    NOT_OWNER(HttpStatus.FORBIDDEN, "只能操作自己的预约"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "资源不存在"),
    USERNAME_TAKEN(HttpStatus.CONFLICT, "用户名已被占用"),
    VENUE_NOT_BOOKABLE(HttpStatus.CONFLICT, "该场馆暂未开放预约"),
    RESOURCE_UNAVAILABLE(HttpStatus.CONFLICT, "该场地当前不可预约"),
    SLOT_NOT_AVAILABLE(HttpStatus.CONFLICT, "该时段不存在或未开放"),
    SLOT_IN_PAST(HttpStatus.CONFLICT, "该时段已开始或已过去"),
    BOOKING_LIMIT_REACHED(HttpStatus.CONFLICT, "已达同时持有预约数上限"),
    SLOT_TAKEN(HttpStatus.CONFLICT, "该时段刚刚被别人预约了，请重新选择"),
    INVALID_STATE(HttpStatus.CONFLICT, "当前状态不允许该操作"),
    CANCEL_DEADLINE_PASSED(HttpStatus.CONFLICT, "已超过可取消时间"),
    ALREADY_CHECKED_IN(HttpStatus.CONFLICT, "已签到"),
    CHECKIN_WINDOW_CLOSED(HttpStatus.CONFLICT, "当前不在签到时间内"),
    NOT_CHECKED_IN(HttpStatus.CONFLICT, "尚未签到"),
    ALREADY_CHECKED_OUT(HttpStatus.CONFLICT, "已签退"),
    USER_NOT_ELIGIBLE(HttpStatus.CONFLICT, "目标用户不可被分配预约"),
    REASON_REQUIRED(HttpStatus.BAD_REQUEST, "请填写原因"),
    IMPACT_CONFIRMATION_REQUIRED(HttpStatus.CONFLICT, "该操作会影响已有预约，请先选择保留或取消"),
    HAS_HISTORY(HttpStatus.CONFLICT, "该场地有历史预约，只能停用不能删除"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "服务器开小差了，请稍后再试");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}
