package com.campus.probe;

import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 类上带 @Validated 的探针：方法参数校验以 ConstraintViolationException 抛出。
 */
@Validated
@RestController
public class ValidatedProbeController {

    @GetMapping("/probe/validated")
    public int validated(@RequestParam @Min(1) int page) {
        return page;
    }
}
