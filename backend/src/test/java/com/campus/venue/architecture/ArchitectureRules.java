package com.campus.venue.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.lang.ArchRule;

/**
 * 分层规则（docs/16 第 4.3 节）。BE-0 还没有 controller、service、repository 类，
 * 所以规则对空集合不报错地通过（allowEmptyShould），BE-1 起才真正约束业务包。
 */
final class ArchitectureRules {

    static final String CONTROLLER = "..controller..";
    static final String REPOSITORY = "..repository..";
    static final String SERVICE = "..service..";
    static final String DOMAIN = "..domain..";

    static final ArchRule CONTROLLER_NOT_DEPEND_ON_REPOSITORY = noClasses()
            .that().resideInAPackage(CONTROLLER)
            .should().dependOnClassesThat().resideInAPackage(REPOSITORY)
            .allowEmptyShould(true);

    static final ArchRule REPOSITORY_NOT_DEPEND_ON_CONTROLLER = noClasses()
            .that().resideInAPackage(REPOSITORY)
            .should().dependOnClassesThat().resideInAPackage(CONTROLLER)
            .allowEmptyShould(true);

    static final ArchRule DOMAIN_NOT_DEPEND_ON_WEB = noClasses()
            .that().resideInAPackage(DOMAIN)
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework.web..", "org.springframework.http..", "jakarta.servlet..")
            .allowEmptyShould(true);

    static final ArchRule TRANSACTIONAL_CLASSES_ONLY_IN_SERVICE = classes()
            .that().areAnnotatedWith(org.springframework.transaction.annotation.Transactional.class)
            .or().areAnnotatedWith(jakarta.transaction.Transactional.class)
            .should().resideInAPackage(SERVICE)
            .allowEmptyShould(true);

    static final ArchRule TRANSACTIONAL_METHODS_ONLY_IN_SERVICE = methods()
            .that().areAnnotatedWith(org.springframework.transaction.annotation.Transactional.class)
            .or().areAnnotatedWith(jakarta.transaction.Transactional.class)
            .should().beDeclaredInClassesThat().resideInAPackage(SERVICE)
            .allowEmptyShould(true);

    private ArchitectureRules() {
    }
}
