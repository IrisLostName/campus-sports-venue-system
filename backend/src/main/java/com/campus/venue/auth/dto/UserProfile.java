package com.campus.venue.auth.dto;

import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.domain.UserType;
import java.util.List;

/** 当前用户资料（docs/12 第 4 节）。phone 可为 null；venueIds 仅 VENUE_ADMIN 返回，其他角色为 null。 */
public record UserProfile(
        long id,
        String username,
        String displayName,
        Role role,
        UserType userType,
        String phone,
        AccountStatus status,
        List<Long> venueIds) {
}
