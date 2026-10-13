package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** M1（ACC-M3-01）：约束、外键（无级联）与索引的名称和数量与 docs/13 一致，没有多余的对象。 */
@IntegrationTest
class MigrationConstraintTest {

    private static final String BUSINESS_TABLES = "('app_user','venue','resource','availability_rule',"
            + "'reservation','usage_record','announcement','repair_report','admin_venue_scope',"
            + "'admin_operation_log')";

    @Autowired
    private JdbcTemplate jdbc;

    private List<String> constraintNames(char type) {
        return jdbc.queryForList("select conname from pg_constraint where contype = '" + type
                + "' and conrelid::regclass::text in " + BUSINESS_TABLES, String.class);
    }

    @Test
    void primaryKeysAreNamedPerTable() {
        assertThat(constraintNames('p')).containsExactlyInAnyOrder("pk_app_user", "pk_venue", "pk_resource",
                "pk_availability_rule", "pk_reservation", "pk_usage_record", "pk_announcement",
                "pk_repair_report", "pk_admin_venue_scope", "pk_admin_operation_log");
    }

    @Test
    void uniqueConstraintsMatchTheDesign() {
        assertThat(constraintNames('u')).containsExactlyInAnyOrder("uq_app_user_username", "uq_venue_name",
                "uq_resource_venue_name", "uq_usage_record_reservation", "uq_admin_venue_scope_admin_venue");
    }

    @Test
    void checkConstraintsMatchTheDesign() {
        assertThat(constraintNames('c')).containsExactlyInAnyOrder(
                "ck_app_user_role", "ck_app_user_user_type", "ck_app_user_status",
                "ck_venue_venue_type", "ck_venue_operational_status",
                "ck_resource_resource_type", "ck_resource_operational_status",
                "ck_availability_rule_type", "ck_availability_rule_status",
                "ck_availability_rule_weekly", "ck_availability_rule_closure",
                "ck_reservation_status", "ck_reservation_time_order", "ck_usage_record_times",
                "ck_announcement_scope", "ck_announcement_status", "ck_announcement_scope_venue",
                "ck_repair_report_status", "ck_admin_venue_scope_status",
                "ck_admin_operation_log_action", "ck_admin_operation_log_target_type");
    }

    @Test
    void foreignKeysAreExplicitAndNeverCascade() {
        List<String> rules = jdbc.queryForList("""
                select conname || ':' || confdeltype::text || confupdtype::text from pg_constraint
                where contype = 'f' and conrelid::regclass::text in %s
                """.formatted(BUSINESS_TABLES), String.class);

        assertThat(rules).hasSize(19).allMatch(rule -> rule.endsWith(":aa"));
        assertThat(rules).extracting(rule -> rule.substring(0, rule.indexOf(':'))).containsExactlyInAnyOrder(
                "fk_resource_venue",
                "fk_availability_rule_venue", "fk_availability_rule_resource", "fk_availability_rule_created_by",
                "fk_reservation_user", "fk_reservation_resource", "fk_reservation_cancelled_by",
                "fk_usage_record_reservation",
                "fk_announcement_venue", "fk_announcement_published_by",
                "fk_repair_report_venue", "fk_repair_report_resource", "fk_repair_report_reporter",
                "fk_repair_report_handled_by",
                "fk_admin_venue_scope_admin", "fk_admin_venue_scope_venue", "fk_admin_venue_scope_granted_by",
                "fk_admin_operation_log_admin", "fk_admin_operation_log_venue");
    }

    @Test
    void indexesAreExactlyThoseListedInTheDesignPlusConstraintIndexes() {
        List<String> indexes = jdbc.queryForList(
                "select indexname from pg_indexes where schemaname = 'public' and tablename in "
                        + BUSINESS_TABLES, String.class);

        assertThat(indexes).containsExactlyInAnyOrder(
                "pk_app_user", "pk_venue", "pk_resource", "pk_availability_rule", "pk_reservation",
                "pk_usage_record", "pk_announcement", "pk_repair_report", "pk_admin_venue_scope",
                "pk_admin_operation_log",
                "uq_app_user_username", "uq_venue_name", "uq_resource_venue_name", "uq_usage_record_reservation",
                "uq_admin_venue_scope_admin_venue", "uq_reservation_active_slot",
                "idx_resource_venue_sort", "idx_availability_rule_venue_type_status",
                "idx_reservation_user_date", "idx_reservation_resource_date", "idx_reservation_status_date",
                "idx_announcement_scope_status_published", "idx_announcement_venue_status",
                "idx_admin_operation_log_venue_created", "idx_admin_operation_log_admin_created");
    }

    @Test
    void descendingIndexColumnsAreDescending() {
        List<String> defs = jdbc.queryForList("""
                select indexdef from pg_indexes where schemaname = 'public' and indexname in
                ('idx_announcement_scope_status_published', 'idx_admin_operation_log_venue_created',
                 'idx_admin_operation_log_admin_created')
                """, String.class);

        assertThat(defs).hasSize(3).allMatch(def -> def.contains(" DESC"));
    }
}
