package com.campus.venue.common;

/**
 * 关键字的字面包含匹配（BE-5 A1 起，BE-6 C6 复用）：去掉首尾空白后，反斜杠、%、_ 转义（转义符为反斜杠），前后加 %；
 * 空白视为未填。与 mock 的 matchesKeyword 一致；调用方以 lower(列) LIKE lower(模式) ESCAPE '\' 使用。
 */
public final class LikePattern {

    private LikePattern() {
    }

    /** null 表示不过滤。 */
    public static String contains(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String escaped = keyword.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
