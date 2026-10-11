package com.campus.venue.architecture;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 证明分层规则真的会拦截：对故意违规的夹具类，每条规则都必须失败；
 * 对合规夹具与空集合（BE-0 的实际情况）必须通过。
 */
class ArchitectureRulesEffectivenessTest {

    private static final JavaClasses BAD = new ClassFileImporter().importPackages("com.campus.archfixture.bad");
    private static final JavaClasses GOOD = new ClassFileImporter().importPackages("com.campus.archfixture.good");
    private static final JavaClasses NOTHING = new ClassFileImporter().importPackages("com.campus.archfixture.none");

    private static final List<ArchRule> ALL_RULES = List.of(
            ArchitectureRules.CONTROLLER_NOT_DEPEND_ON_REPOSITORY,
            ArchitectureRules.REPOSITORY_NOT_DEPEND_ON_CONTROLLER,
            ArchitectureRules.DOMAIN_NOT_DEPEND_ON_WEB,
            ArchitectureRules.TRANSACTIONAL_CLASSES_ONLY_IN_SERVICE,
            ArchitectureRules.TRANSACTIONAL_METHODS_ONLY_IN_SERVICE,
            ArchitectureRules.SERVICE_CLASSES_DIRECTLY_IN_SERVICE_PACKAGE,
            ArchitectureRules.NO_RESPONSE_STATUS_EXCEPTION);

    @Test
    void classesInNestedServiceSubpackagesAreRejected() {
        assertThatThrownBy(() -> ArchitectureRules.SERVICE_CLASSES_DIRECTLY_IN_SERVICE_PACKAGE.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadNestedService");
    }

    @Test
    void responseStatusExceptionAndItsSubclassesAreRejected() {
        assertThatThrownBy(() -> ArchitectureRules.NO_RESPONSE_STATUS_EXCEPTION.check(BAD))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("BadStatusThrower")
                .hasMessageContaining("BadStatusSubclass")
                .hasMessageContaining("BadStatusSubtypeThrower");
    }

    @Test
    void controllerDependingOnRepositoryIsRejected() {
        assertThatThrownBy(() -> ArchitectureRules.CONTROLLER_NOT_DEPEND_ON_REPOSITORY.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadController");
    }

    @Test
    void repositoryDependingOnControllerIsRejected() {
        assertThatThrownBy(() -> ArchitectureRules.REPOSITORY_NOT_DEPEND_ON_CONTROLLER.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadRepository");
    }

    @Test
    void domainDependingOnWebClassesIsRejected() {
        assertThatThrownBy(() -> ArchitectureRules.DOMAIN_NOT_DEPEND_ON_WEB.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadEntity");
    }

    @Test
    void transactionalOutsideServiceIsRejectedOnClassesAndMethods() {
        assertThatThrownBy(() -> ArchitectureRules.TRANSACTIONAL_CLASSES_ONLY_IN_SERVICE.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadTransactionalClass");
        assertThatThrownBy(() -> ArchitectureRules.TRANSACTIONAL_METHODS_ONLY_IN_SERVICE.check(BAD))
                .isInstanceOf(AssertionError.class).hasMessageContaining("BadTransactionalMethod");
    }

    @Test
    void compliantFixturesPassEveryRule() {
        for (ArchRule rule : ALL_RULES) {
            assertThatCode(() -> rule.check(GOOD)).doesNotThrowAnyException();
        }
    }

    @Test
    void emptyClassSetsPassEveryRuleWithoutError() {
        for (ArchRule rule : ALL_RULES) {
            assertThatCode(() -> rule.check(NOTHING)).doesNotThrowAnyException();
        }
    }
}
