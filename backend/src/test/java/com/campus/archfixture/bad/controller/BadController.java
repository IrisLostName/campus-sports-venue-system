package com.campus.archfixture.bad.controller;

import com.campus.archfixture.bad.repository.BadRepository;

/** 违反分层的夹具：controller 直接依赖 repository。仅供架构规则有效性测试使用。 */
public class BadController {

    private final BadRepository repository;

    public BadController(BadRepository repository) {
        this.repository = repository;
    }

    public BadRepository getRepository() {
        return repository;
    }
}
