package com.campus.venue.common.error;

import java.util.Map;

/**
 * 业务异常：业务规则失败一律抛出它，由全局异常处理转换为 ErrorBody。
 */
public class BusinessException extends RuntimeException {

    private final transient ErrorCode errorCode;
    private final transient Map<String, Object> details;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, null);
    }

    public BusinessException(ErrorCode errorCode, Map<String, Object> details) {
        super(errorCode.name());
        this.errorCode = errorCode;
        this.details = details;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    /** 附加信息，没有时为 null。 */
    public Map<String, Object> getDetails() {
        return details;
    }
}
