package com.campus.archfixture.bad.web;

import org.springframework.transaction.annotation.Transactional;

/** 违反分层的夹具：@Transactional 出现在 service 之外的类上。仅供架构规则有效性测试使用。 */
@Transactional
public class BadTransactionalClass {

    public void work() {
        // 空实现：夹具只关心注解的位置
    }
}
