package com.campus.venue.auth.dto;

/**
 * 注册请求（docs/12 第 5.1 节、BE-1 A1）。请求体中的 role、status 等其他字段一律忽略。
 * 字段约束为与 POST /admin/users 共用的组合约束（BE-6 P1），文案与原先逐条一致。
 */
public record RegisterRequest(
        @AccountUsername
        String username,

        @AccountPassword
        String password,

        @AccountDisplayName
        String displayName,

        @AccountUserType
        String userType,

        @AccountPhone
        String phone) {
}
