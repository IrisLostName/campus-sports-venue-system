package com.campus.venue.auth.service;

import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.user.domain.AppUser;
import java.util.List;

/** AppUser → UserProfile（字段与 docs/12 第 4 节逐字一致）。 */
final class UserProfileMapper {

    private UserProfileMapper() {
    }

    static UserProfile toProfile(AppUser user, List<Long> venueIds) {
        return new UserProfile(user.getId(), user.getUsername(), user.getDisplayName(), user.getRole(),
                user.getUserType(), user.getPhone(), user.getStatus(), venueIds);
    }
}
