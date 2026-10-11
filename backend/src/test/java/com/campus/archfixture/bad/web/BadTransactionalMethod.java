package com.campus.archfixture.bad.web;

import jakarta.transaction.Transactional;

/** 违反分层的夹具：@Transactional 出现在 service 之外的方法上。仅供架构规则有效性测试使用。 */
public class BadTransactionalMethod {

    @Transactional
    public void work() {
        // 空实现：夹具只关心注解的位置
    }
}
