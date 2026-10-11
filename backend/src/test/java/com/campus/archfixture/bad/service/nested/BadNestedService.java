package com.campus.archfixture.bad.service.nested;

/** 违反 K3 的夹具：类位于 service 的子包中。仅供架构规则有效性测试使用。 */
public class BadNestedService {

    public void work() {
        // 空实现：夹具只关心类所在的包
    }
}
