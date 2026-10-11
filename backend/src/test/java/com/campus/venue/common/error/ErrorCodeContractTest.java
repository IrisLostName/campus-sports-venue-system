package com.campus.venue.common.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * 错误码契约测试：解析 docs/12 第 3 节表格，与 ErrorCode 枚举双向比对 code、HTTP 状态与默认文案。
 * 文案仅有两项按 BE-0 裁决 R1 例外。文件不存在时测试失败，不跳过。
 */
class ErrorCodeContractTest {

    private static final Path CONTRACT = Path.of("..", "docs", "12-api-contract.md");
    private static final Pattern ROW =
            Pattern.compile("^\\|\\s*`([A-Z][A-Z_]+)`\\s*\\|\\s*(\\d{3})\\s*\\|\\s*([^|]*?)\\s*\\|");
    private static final int EXPECTED_CODE_COUNT = 29;
    /** R1：这两项的文案与表格第三列原文不同。 */
    private static final Map<String, String> MESSAGE_EXCEPTIONS = Map.of(
            "RULE_INVALID", "开放规则不合法",
            "HAS_HISTORY", "该场地有历史预约，只能停用不能删除");

    /** 表格一行：HTTP 状态与第三列原文。 */
    private record Row(int status, String message) {
    }

    private static Map<String, Row> parseContractTable() {
        if (!Files.isRegularFile(CONTRACT)) {
            fail("找不到接口契约文件：" + CONTRACT.toAbsolutePath().normalize()
                    + "（后端须在本机构建，docs/ 不进 GitHub）；错误码契约测试不得跳过");
        }
        List<String> lines;
        try {
            lines = Files.readAllLines(CONTRACT, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("无法读取接口契约文件 " + CONTRACT, e);
        }
        Map<String, Row> rows = new LinkedHashMap<>();
        boolean inSection = false;
        for (String line : lines) {
            if (line.startsWith("## ")) {
                inSection = line.startsWith("## 3.");
            }
            Matcher matcher = ROW.matcher(line);
            if (inSection && matcher.find()) {
                rows.put(matcher.group(1), new Row(Integer.parseInt(matcher.group(2)), matcher.group(3)));
            }
        }
        return rows;
    }

    private static Map<String, Row> enumRows() {
        Map<String, Row> rows = new LinkedHashMap<>();
        for (ErrorCode code : ErrorCode.values()) {
            rows.put(code.name(), new Row(code.getStatus().value(), code.getDefaultMessage()));
        }
        return rows;
    }

    @Test
    void contractTableHasTheExpectedNumberOfCodes() {
        assertThat(parseContractTable()).hasSize(EXPECTED_CODE_COUNT);
        assertThat(ErrorCode.values()).hasSize(EXPECTED_CODE_COUNT);
    }

    @Test
    void codeSetsMatchInBothDirections() {
        Set<String> documented = new TreeSet<>(parseContractTable().keySet());
        Set<String> implemented = new TreeSet<>(enumRows().keySet());

        Set<String> missingInEnum = new TreeSet<>(documented);
        missingInEnum.removeAll(implemented);
        Set<String> missingInDocs = new TreeSet<>(implemented);
        missingInDocs.removeAll(documented);

        assertThat(missingInEnum).as("docs/12 第 3 节有而 ErrorCode 没有的错误码").isEmpty();
        assertThat(missingInDocs).as("ErrorCode 有而 docs/12 第 3 节没有的错误码").isEmpty();
    }

    @Test
    void httpStatusMatchesForEveryCode() {
        Map<String, Row> documented = parseContractTable();
        Map<String, Integer> mismatches = new LinkedHashMap<>();
        for (Map.Entry<String, Row> entry : enumRows().entrySet()) {
            Row doc = documented.get(entry.getKey());
            if (doc != null && doc.status() != entry.getValue().status()) {
                mismatches.put(entry.getKey(), entry.getValue().status());
            }
        }
        assertThat(mismatches).as("HTTP 状态与 docs/12 不一致的错误码").isEmpty();
    }

    @Test
    void defaultMessageMatchesExceptForTheTwoRulingExceptions() {
        Map<String, Row> documented = parseContractTable();
        List<String> mismatches = new ArrayList<>();
        for (Map.Entry<String, Row> entry : enumRows().entrySet()) {
            Row doc = documented.get(entry.getKey());
            String expected = MESSAGE_EXCEPTIONS.getOrDefault(entry.getKey(), doc == null ? null : doc.message());
            if (expected != null && !expected.equals(entry.getValue().message())) {
                mismatches.add(entry.getKey() + " 期望[" + expected + "] 实际[" + entry.getValue().message() + "]");
            }
        }
        assertThat(mismatches).as("默认文案与 docs/12 不一致的错误码").isEmpty();
    }

    @Test
    void messageExceptionsAreExactlyTheTwoRulingOnesAndStillDiffer() {
        Map<String, Row> documented = parseContractTable();
        EnumMap<ErrorCode, String> differing = new EnumMap<>(ErrorCode.class);
        for (ErrorCode code : ErrorCode.values()) {
            Row doc = documented.get(code.name());
            if (doc != null && !doc.message().equals(code.getDefaultMessage())) {
                differing.put(code, code.getDefaultMessage());
            }
        }
        assertThat(differing.keySet()).containsExactlyInAnyOrder(ErrorCode.RULE_INVALID, ErrorCode.HAS_HISTORY);
    }
}
