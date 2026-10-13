package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** M1（ACC-M3-01）：V1__init_schema.sql 的表与列逐一对应 docs/13 第 3 节（类型、可空、默认值、标识列）。 */
@IntegrationTest
class MigrationSchemaTest {

    private static final String TS = "timestamp without time zone";

    private static final List<String> EXPECTED_COLUMNS = List.of(
            "app_user.id|bigint|NO|", "app_user.username|character varying(32)|NO|",
            "app_user.password_hash|character varying(100)|NO|",
            "app_user.display_name|character varying(50)|NO|", "app_user.role|character varying(20)|NO|",
            "app_user.user_type|character varying(20)|NO|'STUDENT'", "app_user.phone|character varying(20)|YES|",
            "app_user.status|character varying(20)|NO|'ACTIVE'", "app_user.created_at|" + TS + "|NO|now()",
            "app_user.updated_at|" + TS + "|NO|now()",
            "venue.id|bigint|NO|", "venue.name|character varying(50)|NO|",
            "venue.venue_type|character varying(20)|NO|", "venue.location|character varying(100)|YES|",
            "venue.description|character varying(500)|YES|",
            "venue.operational_status|character varying(10)|NO|'OPEN'", "venue.user_booking_enabled|boolean|NO|false",
            "venue.created_at|" + TS + "|NO|now()", "venue.updated_at|" + TS + "|NO|now()",
            "resource.id|bigint|NO|", "resource.venue_id|bigint|NO|", "resource.name|character varying(50)|NO|",
            "resource.resource_type|character varying(20)|NO|'COURT'", "resource.sort_order|integer|NO|0",
            "resource.operational_status|character varying(20)|NO|'OPEN'",
            "resource.created_at|" + TS + "|NO|now()", "resource.updated_at|" + TS + "|NO|now()",
            "availability_rule.id|bigint|NO|", "availability_rule.venue_id|bigint|NO|",
            "availability_rule.rule_type|character varying(10)|NO|", "availability_rule.weekday|smallint|YES|",
            "availability_rule.open_time|time without time zone|YES|",
            "availability_rule.close_time|time without time zone|YES|",
            "availability_rule.start_date|date|YES|", "availability_rule.end_date|date|YES|",
            "availability_rule.resource_id|bigint|YES|", "availability_rule.reason|character varying(200)|YES|",
            "availability_rule.status|character varying(10)|NO|'ACTIVE'", "availability_rule.created_by|bigint|YES|",
            "availability_rule.created_at|" + TS + "|NO|now()",
            "reservation.id|bigint|NO|", "reservation.user_id|bigint|NO|", "reservation.resource_id|bigint|NO|",
            "reservation.service_date|date|NO|", "reservation.start_time|time without time zone|NO|",
            "reservation.end_time|time without time zone|NO|",
            "reservation.status|character varying(20)|NO|'CONFIRMED'", "reservation.purpose|character varying(200)|YES|",
            "reservation.created_at|" + TS + "|NO|now()", "reservation.updated_at|" + TS + "|NO|now()",
            "reservation.cancelled_at|" + TS + "|YES|", "reservation.cancelled_by|bigint|YES|",
            "reservation.cancel_reason|character varying(200)|YES|",
            "reservation.admin_note|character varying(200)|YES|",
            "usage_record.id|bigint|NO|", "usage_record.reservation_id|bigint|NO|",
            "usage_record.check_in_at|" + TS + "|NO|", "usage_record.check_out_at|" + TS + "|YES|",
            "announcement.id|bigint|NO|", "announcement.scope|character varying(10)|NO|",
            "announcement.venue_id|bigint|YES|", "announcement.title|character varying(100)|NO|",
            "announcement.content|character varying(2000)|NO|",
            "announcement.status|character varying(10)|NO|'ACTIVE'", "announcement.published_by|bigint|NO|",
            "announcement.published_at|" + TS + "|NO|now()", "announcement.expires_at|" + TS + "|YES|",
            "repair_report.id|bigint|NO|", "repair_report.venue_id|bigint|NO|",
            "repair_report.resource_id|bigint|YES|", "repair_report.reporter_id|bigint|NO|",
            "repair_report.description|character varying(500)|NO|",
            "repair_report.status|character varying(15)|NO|'SUBMITTED'",
            "repair_report.result_note|character varying(500)|YES|", "repair_report.handled_by|bigint|YES|",
            "repair_report.created_at|" + TS + "|NO|now()", "repair_report.updated_at|" + TS + "|NO|now()",
            "admin_venue_scope.id|bigint|NO|", "admin_venue_scope.admin_id|bigint|NO|",
            "admin_venue_scope.venue_id|bigint|NO|", "admin_venue_scope.status|character varying(10)|NO|'ACTIVE'",
            "admin_venue_scope.valid_from|date|YES|", "admin_venue_scope.valid_to|date|YES|",
            "admin_venue_scope.granted_by|bigint|NO|", "admin_venue_scope.granted_at|" + TS + "|NO|now()",
            "admin_operation_log.id|bigint|NO|", "admin_operation_log.admin_id|bigint|NO|",
            "admin_operation_log.venue_id|bigint|YES|", "admin_operation_log.action|character varying(40)|NO|",
            "admin_operation_log.target_type|character varying(20)|NO|", "admin_operation_log.target_id|bigint|YES|",
            "admin_operation_log.reason|character varying(200)|YES|",
            "admin_operation_log.before_snapshot|jsonb|YES|", "admin_operation_log.after_snapshot|jsonb|YES|",
            "admin_operation_log.created_at|" + TS + "|NO|now()");

    private static final String COLUMN_SPEC_SQL = """
            select c.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod) || '|'
                   || case when a.attnotnull then 'NO' else 'YES' end || '|'
                   || coalesce(regexp_replace(pg_get_expr(d.adbin, d.adrelid), '::[a-z ]+$', ''), '')
            from pg_attribute a
            join pg_class c on c.oid = a.attrelid
            join pg_namespace n on n.oid = c.relnamespace
            left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
            where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'flyway_schema_history'
              and a.attnum > 0 and not a.attisdropped
            """;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void everyColumnMatchesTheDatabaseDesign() {
        List<String> actual = jdbc.queryForList(COLUMN_SPEC_SQL, String.class);

        assertThat(actual).containsExactlyInAnyOrderElementsOf(EXPECTED_COLUMNS);
    }

    @Test
    void exactlyTheTenBusinessTablesExist() {
        List<String> tables = jdbc.queryForList("""
                select table_name from information_schema.tables
                where table_schema = 'public' and table_type = 'BASE TABLE'
                  and table_name <> 'flyway_schema_history'
                """, String.class);

        assertThat(tables).containsExactlyInAnyOrder("app_user", "venue", "resource", "availability_rule",
                "reservation", "usage_record", "announcement", "repair_report", "admin_venue_scope",
                "admin_operation_log");
    }

    @Test
    void primaryKeysAreIdentityAlwaysAndNoOtherColumnIsIdentity() {
        List<String> identityColumns = jdbc.queryForList("""
                select c.relname || '.' || a.attname from pg_attribute a
                join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and a.attidentity = 'a' and not a.attisdropped
                """, String.class);

        assertThat(identityColumns).hasSize(10).allMatch(name -> name.endsWith(".id"));
    }

    @Test
    void flywayAppliedOnlyTheStructureMigration() {
        List<String> versions = jdbc.queryForList(
                "select version from flyway_schema_history where success order by installed_rank", String.class);

        assertThat(versions).containsExactly("1");
    }
}
