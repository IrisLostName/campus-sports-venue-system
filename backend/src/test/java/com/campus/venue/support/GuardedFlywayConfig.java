package com.campus.venue.support;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/**
 * 测试上下文启动时：先过护栏，再清库并重新迁移（docs/07：测试前清空并重新迁移）。
 */
@TestConfiguration(proxyBeanMethods = false)
public class GuardedFlywayConfig {

    @Bean
    public FlywayMigrationStrategy guardedCleanAndMigrate() {
        return flyway -> {
            TestDatabaseGuard.require(flyway.getConfiguration().getDataSource());
            flyway.clean();
            flyway.migrate();
        };
    }
}
