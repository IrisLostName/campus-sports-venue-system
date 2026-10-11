package com.campus.venue.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/**
 * 统一错误响应体（docs/12 第 1 节）：没有 details 时省略该键。
 */
public record ErrorBody(
        String code,
        String message,
        @JsonInclude(JsonInclude.Include.NON_NULL) Map<String, Object> details) {

    /** 以错误码的默认文案构造，details 可为 null。 */
    public static ErrorBody of(ErrorCode errorCode, Map<String, Object> details) {
        return new ErrorBody(errorCode.name(), errorCode.getDefaultMessage(), details);
    }
}
