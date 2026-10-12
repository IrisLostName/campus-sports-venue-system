package com.campus.venue.common.error;

import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.firewall.RequestRejectedException;

/**
 * 全局异常处理：把所有异常统一转换为 ErrorBody（BE-0 裁决 R3、R4）。
 * 405 映射为 NOT_FOUND、415 与 406 映射为 VALIDATION_ERROR，均为 API-SYNC 观察项。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String FIELDS = "fields";
    private static final String TYPE_MISMATCH = "类型不符";

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorBody> handleBusiness(BusinessException ex) {
        return respond(ex.getErrorCode(), ex.getDetails());
    }

    /** 请求体校验失败（含 MethodArgumentNotValidException）。 */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<ErrorBody> handleBind(BindException ex) {
        Map<String, Object> fields = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> putFirst(fields, error));
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> fields.putIfAbsent(error.getObjectName(), error.getDefaultMessage()));
        return respond(ErrorCode.VALIDATION_ERROR, Map.of(FIELDS, fields));
    }

    /** 方法参数校验失败（Spring 6.1 的内置方法校验）。 */
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorBody> handleMethodValidation(HandlerMethodValidationException ex) {
        Map<String, Object> fields = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(result -> {
            String name = result.getMethodParameter().getParameterName();
            String key = name == null ? "arg" + result.getMethodParameter().getParameterIndex() : name;
            result.getResolvableErrors().stream().findFirst()
                    .ifPresent(error -> fields.putIfAbsent(key, message(error)));
        });
        return respond(ErrorCode.VALIDATION_ERROR, Map.of(FIELDS, fields));
    }

    /** 类上带 @Validated 时，方法参数校验以 ConstraintViolationException 抛出。 */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorBody> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, Object> fields = new LinkedHashMap<>();
        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
            String path = violation.getPropertyPath().toString();
            fields.putIfAbsent(path.substring(path.lastIndexOf('.') + 1), violation.getMessage());
        }
        return respond(ErrorCode.VALIDATION_ERROR, Map.of(FIELDS, fields));
    }

    /**
     * 请求体无法转换（BE-3 裁决第 12 节，在 BE-1 F1 的 U+0000 处理上推广）：Jackson 能定位到字段的格式/类型错误
     * （MismatchedInputException 及其子类且带路径）在 details.fields 中指明字段，U+0000 文案不变；
     * 无法定位字段的（JSON 语法错误、空请求体、裸值请求体）不带 details。
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorBody> handleUnreadable(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof MismatchedInputException mismatch) {
            String path = JsonFieldPath.of(mismatch);
            if (!path.isEmpty()) {
                String reason = mismatch instanceof NulCharacterException ? "不能包含 U+0000 字符" : TYPE_MISMATCH;
                return respond(ErrorCode.VALIDATION_ERROR, Map.of(FIELDS, Map.of(path, reason)));
            }
        }
        return respond(ErrorCode.VALIDATION_ERROR, null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorBody> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return respond(ErrorCode.VALIDATION_ERROR, Map.of(FIELDS, Map.of(ex.getName(), TYPE_MISMATCH)));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorBody> handleMissingParameter(MissingServletRequestParameterException ex) {
        return respond(ErrorCode.VALIDATION_ERROR,
                Map.of(FIELDS, Map.of(ex.getParameterName(), "缺少必填参数")));
    }

    /** 其他请求绑定失败（缺少请求头、路径变量等）。 */
    @ExceptionHandler(ServletRequestBindingException.class)
    public ResponseEntity<ErrorBody> handleBinding(ServletRequestBindingException ex) {
        return respond(ErrorCode.VALIDATION_ERROR, null);
    }

    /** 不存在的路径：返回 ErrorBody，而不是框架默认页。 */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorBody> handleNotFound(Exception ex) {
        return respond(ErrorCode.NOT_FOUND, null);
    }

    /** 405：docs/12 未规定，按 R4 映射为 NOT_FOUND。 */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorBody> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return respond(ErrorCode.NOT_FOUND, null);
    }

    /** 415 与 406：docs/12 未规定，映射为 VALIDATION_ERROR。 */
    @ExceptionHandler({HttpMediaTypeNotSupportedException.class, HttpMediaTypeNotAcceptableException.class})
    public ResponseEntity<ErrorBody> handleMediaType(Exception ex) {
        return respond(ErrorCode.VALIDATION_ERROR, null);
    }

    /** 方法级角色注解拒绝（P2）：进入 MVC 异常处理，不能落入 500 兜底。 */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorBody> handleAccessDenied(AccessDeniedException ex) {
        return respond(ErrorCode.FORBIDDEN, null);
    }

    /**
     * StrictHttpFirewall 对参数名的检查是惰性的：首次读取参数表（如 U+0000 参数检查拦截器）时才抛出。
     * 与过滤器阶段的防火墙拒绝一致（BE-1 裁决第 11 节第 5 条）：400 VALIDATION_ERROR，不带 details。
     */
    @ExceptionHandler(RequestRejectedException.class)
    public ResponseEntity<ErrorBody> handleRequestRejected(RequestRejectedException ex) {
        return respond(ErrorCode.VALIDATION_ERROR, null);
    }

    /** 认证异常（P2）。 */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorBody> handleAuthentication(AuthenticationException ex) {
        return respond(ErrorCode.AUTH_REQUIRED, null);
    }

    /** 兜底：服务端记录堆栈，响应不含堆栈与异常原文。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorBody> handleUnexpected(Exception ex) {
        LOG.error("未预期的异常", ex);
        return respond(ErrorCode.INTERNAL_ERROR, null);
    }

    private static void putFirst(Map<String, Object> fields, FieldError error) {
        fields.putIfAbsent(error.getField(), error.getDefaultMessage());
    }

    private static String message(MessageSourceResolvable error) {
        return error.getDefaultMessage();
    }

    private static ResponseEntity<ErrorBody> respond(ErrorCode code, Map<String, Object> details) {
        return ResponseEntity.status(code.getStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(ErrorBody.of(code, details));
    }
}
