package com.campus.venue.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import com.campus.venue.announcement.domain.AnnouncementScope;
import com.campus.venue.announcement.domain.AnnouncementStatus;
import com.campus.venue.audit.domain.LogAction;
import com.campus.venue.audit.domain.LogTargetType;
import com.campus.venue.audit.domain.VenueScopeStatus;
import com.campus.venue.availability.domain.AvailabilityRuleStatus;
import com.campus.venue.availability.domain.AvailabilityRuleType;
import com.campus.venue.repair.domain.RepairStatus;
import com.campus.venue.reservation.domain.ReservationStatus;
import com.campus.venue.support.IntegrationTest;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.domain.UserType;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.ResourceType;
import com.campus.venue.venue.domain.VenueStatus;
import com.campus.venue.venue.domain.VenueType;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * E1：Java 枚举取值与数据库 CHECK 约束、docs/12 第 2 节的枚举表三方一致。
 */
@IntegrationTest
class EnumCheckConsistencyTest {

    private static final Path CONTRACT = Path.of("..", "docs", "12-api-contract.md");
    private static final Pattern QUOTED = Pattern.compile("'([A-Z_]+)'");
    private static final Pattern BACKTICKED = Pattern.compile("`([A-Za-z_]+)`");

    private static final Map<String, Class<? extends Enum<?>>> CHECK_TO_ENUM = Map.ofEntries(
            Map.entry("ck_app_user_role", Role.class),
            Map.entry("ck_app_user_user_type", UserType.class),
            Map.entry("ck_app_user_status", AccountStatus.class),
            Map.entry("ck_venue_venue_type", VenueType.class),
            Map.entry("ck_venue_operational_status", VenueStatus.class),
            Map.entry("ck_resource_resource_type", ResourceType.class),
            Map.entry("ck_resource_operational_status", ResourceStatus.class),
            Map.entry("ck_availability_rule_type", AvailabilityRuleType.class),
            Map.entry("ck_availability_rule_status", AvailabilityRuleStatus.class),
            Map.entry("ck_reservation_status", ReservationStatus.class),
            Map.entry("ck_announcement_scope", AnnouncementScope.class),
            Map.entry("ck_announcement_status", AnnouncementStatus.class),
            Map.entry("ck_repair_report_status", RepairStatus.class),
            Map.entry("ck_admin_venue_scope_status", VenueScopeStatus.class),
            Map.entry("ck_admin_operation_log_action", LogAction.class),
            Map.entry("ck_admin_operation_log_target_type", LogTargetType.class));

    /** docs/12 第 2 节枚举表里出现的名称对应的 Java 枚举。 */
    private static final Map<String, Class<? extends Enum<?>>> DOC_TO_ENUM = Map.ofEntries(
            Map.entry("Role", Role.class), Map.entry("UserType", UserType.class),
            Map.entry("AccountStatus", AccountStatus.class), Map.entry("VenueType", VenueType.class),
            Map.entry("VenueStatus", VenueStatus.class), Map.entry("ResourceType", ResourceType.class),
            Map.entry("ResourceStatus", ResourceStatus.class),
            Map.entry("ReservationStatus", ReservationStatus.class),
            Map.entry("AnnouncementScope", AnnouncementScope.class),
            Map.entry("AnnouncementStatus", AnnouncementStatus.class),
            Map.entry("RepairStatus", RepairStatus.class), Map.entry("LogAction", LogAction.class),
            Map.entry("LogTargetType", LogTargetType.class));

    @Autowired
    private JdbcTemplate jdbc;

    private static Set<String> namesOf(Class<? extends Enum<?>> type) {
        Set<String> names = new LinkedHashSet<>();
        Arrays.stream(type.getEnumConstants()).forEach(constant -> names.add(constant.name()));
        return names;
    }

    private static Set<String> matches(Pattern pattern, String text) {
        Set<String> found = new LinkedHashSet<>();
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            found.add(matcher.group(1));
        }
        return found;
    }

    @Test
    void everyEnumCheckConstraintListsExactlyTheJavaEnumValues() {
        for (Map.Entry<String, Class<? extends Enum<?>>> entry : CHECK_TO_ENUM.entrySet()) {
            String definition = jdbc.queryForObject(
                    "select pg_get_constraintdef(oid) from pg_constraint where conname = ?",
                    String.class, entry.getKey());

            assertThat(matches(QUOTED, definition)).as(entry.getKey())
                    .containsExactlyInAnyOrderElementsOf(namesOf(entry.getValue()));
        }
    }

    @Test
    void javaEnumsMatchTheEnumTableInTheApiContract() throws IOException {
        if (!Files.isRegularFile(CONTRACT)) {
            fail("找不到接口契约文件：" + CONTRACT.toAbsolutePath().normalize() + "；枚举核对测试不得跳过");
        }
        List<String> lines = Files.readAllLines(CONTRACT, StandardCharsets.UTF_8);
        boolean inSection = false;
        int checked = 0;
        for (String line : lines) {
            if (line.startsWith("## ")) {
                inSection = line.startsWith("## 2.");
            }
            String[] cells = line.split("\\|");
            if (!inSection || cells.length < 3) {
                continue;
            }
            Set<String> nameCell = matches(BACKTICKED, cells[1]);
            String docName = nameCell.isEmpty() ? "" : nameCell.iterator().next();
            Class<? extends Enum<?>> type = DOC_TO_ENUM.get(docName);
            if (type != null) {
                assertThat(matches(BACKTICKED, cells[2])).as(docName)
                        .containsExactlyInAnyOrderElementsOf(namesOf(type));
                checked++;
            }
        }
        assertThat(checked).isEqualTo(DOC_TO_ENUM.size());
    }
}
