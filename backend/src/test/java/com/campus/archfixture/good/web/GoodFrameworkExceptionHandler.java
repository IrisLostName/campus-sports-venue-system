package com.campus.archfixture.good.web;

import org.springframework.web.method.annotation.HandlerMethodValidationException;

/** 符合 K4 的夹具：只捕获框架抛出的 ResponseStatusException 子类，不引用、不构造。仅供架构规则有效性测试使用。 */
public class GoodFrameworkExceptionHandler {

    public int handle(HandlerMethodValidationException ex) {
        return ex.getParameterValidationResults().size();
    }
}
