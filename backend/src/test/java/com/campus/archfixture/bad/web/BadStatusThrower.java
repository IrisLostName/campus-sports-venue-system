package com.campus.archfixture.bad.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** 违反 K4 的夹具：直接抛 ResponseStatusException。仅供架构规则有效性测试使用。 */
public class BadStatusThrower {

    public void fail() {
        throw new ResponseStatusException(HttpStatus.CONFLICT);
    }
}
