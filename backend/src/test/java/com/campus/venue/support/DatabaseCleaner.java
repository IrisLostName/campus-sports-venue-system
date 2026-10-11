package com.campus.venue.support;

import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 测试方法之间截断 10 张业务表（同时重置标识列），截断前先过护栏。
 */
public final class DatabaseCleaner {

    private static final String TRUNCATE_ALL = "TRUNCATE TABLE admin_operation_log, admin_venue_scope, "
            + "repair_report, announcement, usage_record, reservation, availability_rule, resource, venue, "
            + "app_user RESTART IDENTITY CASCADE";

    private DatabaseCleaner() {
    }

    public static void truncateAll(DataSource dataSource) {
        TestDatabaseGuard.require(dataSource);
        new JdbcTemplate(dataSource).execute(TRUNCATE_ALL);
    }
}
