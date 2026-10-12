package com.campus.archfixture.bad.web;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** 违反 K4 的夹具：继承 ResponseStatusException。仅供架构规则有效性测试使用。 */
public class BadStatusSubclass extends ResponseStatusException {

    public BadStatusSubclass() {
        super(HttpStatus.CONFLICT);
    }
}
