package com.campus.archfixture.good.service;

import org.springframework.transaction.annotation.Transactional;

/** 符合分层的夹具：@Transactional 只出现在 service 包。仅供架构规则有效性测试使用。 */
@Transactional
public class GoodService {

    @Transactional
    public void work() {
        // 空实现：夹具只关心注解的位置
    }
}
