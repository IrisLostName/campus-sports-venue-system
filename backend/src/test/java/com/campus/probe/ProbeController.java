package com.campus.probe;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅测试用的探针控制器：按需抛出各类异常，验证全局异常处理与 JSON 时间格式。
 * 放在 com.campus.probe 下，不在应用的组件扫描范围内，由测试显式 @Import。
 */
@RestController
public class ProbeController {

    /** 时间格式探针的请求与响应载体。 */
    public record TimeProbe(LocalDate date, LocalTime time, LocalDateTime instant) {
    }

    /** 请求体校验探针的载体。 */
    public record NameRequest(@NotBlank String name, @Min(1) Integer age) {
    }

    @GetMapping("/probe/business")
    public String business(@RequestParam String code, @RequestParam(required = false) String detail) {
        ErrorCode errorCode = ErrorCode.valueOf(code);
        if (detail == null) {
            throw new BusinessException(errorCode);
        }
        throw new BusinessException(errorCode, Map.of("reason", detail));
    }

    @PostMapping("/probe/body")
    public String body(@Valid @RequestBody NameRequest request) {
        return request.name();
    }

    @GetMapping("/probe/count")
    public int count(@RequestParam int count) {
        return count;
    }

    @GetMapping("/probe/min")
    public int min(@RequestParam @Min(1) int size) {
        return size;
    }

    @GetMapping("/probe/boom")
    public String boom() {
        throw new IllegalStateException("secret-internal-detail");
    }

    @GetMapping("/probe/get-only")
    public String getOnly() {
        return "ok";
    }

    @PostMapping(value = "/probe/json-only", consumes = "application/json")
    public String jsonOnly(@RequestBody Map<String, Object> payload) {
        return String.valueOf(payload.size());
    }

    @GetMapping(value = "/probe/xml-only", produces = "application/xml")
    public String xmlOnly() {
        return "<ok/>";
    }

    @GetMapping("/probe/time")
    public TimeProbe time() {
        return new TimeProbe(LocalDate.of(2026, 10, 12), LocalTime.of(8, 0), LocalDateTime.of(2026, 10, 12, 9, 0, 0));
    }

    @PostMapping("/probe/time")
    public TimeProbe echoTime(@RequestBody TimeProbe probe) {
        return probe;
    }
}
