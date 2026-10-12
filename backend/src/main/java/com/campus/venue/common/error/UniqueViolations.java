package com.campus.venue.common.error;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 唯一约束冲突的识别（docs/16 第 5 节第 2 条）：只有 SQLState 23505 且约束名为指定名称才算，其他约束错误由调用方照常抛出。
 * BE-3 起使用；AuthService、VenueService 的同类写法在 BE-2b 时统一（BE-3 裁决第 12 节第 3 条）。
 */
public final class UniqueViolations {

    private static final String UNIQUE_VIOLATION = "23505";

    private UniqueViolations() {
    }

    public static boolean isViolationOf(DataIntegrityViolationException ex, String constraintName) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                return UNIQUE_VIOLATION.equals(violation.getSQLState())
                        && constraintName.equals(violation.getConstraintName());
            }
        }
        return false;
    }
}
