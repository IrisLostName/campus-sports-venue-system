package com.campus.venue.common.web;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * 查询参数与路径变量统一拒绝 U+0000（BE-2a 裁决 G4，BE-3 首次触发）：400 VALIDATION_ERROR，details.fields 指明参数名，
 * 文案与请求体的 U+0000 一致。拦截器在安全过滤器之后、控制器（及其方法级角色注解）之前执行，保持“认证 → 格式 → 角色”。
 * 路径中的 %00 可能先被 StrictHttpFirewall 拒绝（BE-1：400 无 details）；防火墙放行的形式由这里兜底。
 */
public class NulParameterInterceptor implements HandlerInterceptor {

    static final String NUL_MESSAGE = "不能包含 U+0000 字符";
    private static final char NUL = '\u0000';

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        for (Map.Entry<String, String[]> parameter : request.getParameterMap().entrySet()) {
            rejectIfNul(parameter.getKey(), parameter.getKey());
            for (String value : parameter.getValue()) {
                rejectIfNul(parameter.getKey(), value);
            }
        }
        if (request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE) instanceof Map<?, ?> variables) {
            variables.forEach((name, value) -> rejectIfNul(String.valueOf(name), String.valueOf(value)));
        }
        return true;
    }

    private static void rejectIfNul(String name, String value) {
        if (value != null && value.indexOf(NUL) >= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, Map.of("fields", Map.of(name, NUL_MESSAGE)));
        }
    }
}
