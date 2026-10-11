package com.campus.archfixture.bad.web;

import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.web.server.MethodNotAllowedException;

/** 违反 K4 的夹具：构造 ResponseStatusException 的框架子类。仅供架构规则有效性测试使用。 */
public class BadStatusSubtypeThrower {

    public void fail() {
        throw new MethodNotAllowedException(HttpMethod.GET, List.of());
    }
}
