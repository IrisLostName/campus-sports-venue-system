package com.campus.archfixture.bad.domain;

import jakarta.servlet.http.HttpServletRequest;

/** 违反分层的夹具：domain 依赖 Web 类。仅供架构规则有效性测试使用。 */
public class BadEntity {

    private HttpServletRequest request;

    public HttpServletRequest getRequest() {
        return request;
    }

    public void setRequest(HttpServletRequest request) {
        this.request = request;
    }
}
