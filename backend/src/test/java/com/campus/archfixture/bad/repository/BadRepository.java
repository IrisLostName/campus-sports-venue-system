package com.campus.archfixture.bad.repository;

import com.campus.archfixture.bad.controller.BadController;

/** 违反分层的夹具：repository 反向依赖 controller。仅供架构规则有效性测试使用。 */
public class BadRepository {

    public String describe(BadController controller) {
        return String.valueOf(controller);
    }
}
