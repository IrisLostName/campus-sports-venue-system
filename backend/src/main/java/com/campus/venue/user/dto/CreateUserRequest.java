package com.campus.venue.user.dto;

import com.campus.venue.auth.dto.AccountDisplayName;
import com.campus.venue.auth.dto.AccountPassword;
import com.campus.venue.auth.dto.AccountPhone;
import com.campus.venue.auth.dto.AccountUserType;
import com.campus.venue.auth.dto.AccountUsername;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;

/**
 * 创建账号请求（docs/12 第 5.9 节，BE-6 U2）：用户名、口令、姓名、userType、phone 的约束与注册共用（同一组合约束，文案一致）；
 * role 必填三值之一；venueIds 可选，元素须为正整数，仅当 role=VENUE_ADMIN 时写入授权。
 */
public record CreateUserRequest(
        @AccountUsername
        String username,

        @AccountPassword
        String password,

        @AccountDisplayName
        String displayName,

        @NotNull(message = "必填")
        @Pattern(regexp = "USER|VENUE_ADMIN|SYS_ADMIN", message = "应为 USER/VENUE_ADMIN/SYS_ADMIN 之一")
        String role,

        @AccountUserType
        String userType,

        @AccountPhone
        String phone,

        @VenueIdList
        List<Long> venueIds) {
}
