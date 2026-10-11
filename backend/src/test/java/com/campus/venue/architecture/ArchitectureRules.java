package com.campus.venue.architecture;

import static com.tngtech.archunit.core.domain.JavaCall.Predicates.target;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.assignableTo;
import static com.tngtech.archunit.core.domain.properties.HasOwner.Predicates.With.owner;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.lang.ArchRule;
import org.springframework.web.server.ResponseStatusException;

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

    /** K3：service 包下不建子包，使 JaCoCo 的 com.campus.venue.*.service 规则覆盖全部服务类。 */
    static final ArchRule SERVICE_CLASSES_DIRECTLY_IN_SERVICE_PACKAGE = classes()
            .that().resideInAPackage(SERVICE)
            .should().resideInAPackage("..service")
            .allowEmptyShould(true);

    /**
     * K4：业务失败一律抛 BusinessException(ErrorCode)。主代码不得引用 ResponseStatusException、
     * 不得继承它、也不得构造它的任何子类；捕获框架抛出的子类（如 HandlerMethodValidationException）不受限。
     */
    static final ArchRule NO_RESPONSE_STATUS_EXCEPTION = noClasses()
            .should().dependOnClassesThat().belongToAnyOf(ResponseStatusException.class)
            .orShould().beAssignableTo(ResponseStatusException.class)
            .orShould().callConstructorWhere(target(owner(assignableTo(ResponseStatusException.class))))
            .allowEmptyShould(true);

    private ArchitectureRules() {
    }
}
