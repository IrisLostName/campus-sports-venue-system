package com.campus.venue.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** 分层测试：只约束主代码（不含测试类）。 */
@AnalyzeClasses(packages = "com.campus.venue", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule CONTROLLER_NOT_DEPEND_ON_REPOSITORY = ArchitectureRules.CONTROLLER_NOT_DEPEND_ON_REPOSITORY;

    @ArchTest
    static final ArchRule REPOSITORY_NOT_DEPEND_ON_CONTROLLER = ArchitectureRules.REPOSITORY_NOT_DEPEND_ON_CONTROLLER;

    @ArchTest
    static final ArchRule DOMAIN_NOT_DEPEND_ON_WEB = ArchitectureRules.DOMAIN_NOT_DEPEND_ON_WEB;

    @ArchTest
    static final ArchRule TRANSACTIONAL_CLASSES_ONLY_IN_SERVICE = ArchitectureRules.TRANSACTIONAL_CLASSES_ONLY_IN_SERVICE;

    @ArchTest
    static final ArchRule TRANSACTIONAL_METHODS_ONLY_IN_SERVICE = ArchitectureRules.TRANSACTIONAL_METHODS_ONLY_IN_SERVICE;
}
