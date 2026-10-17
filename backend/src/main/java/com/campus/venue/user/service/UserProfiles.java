package com.campus.venue.user.service;

import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.auth.service.UserProfileMapper;
import com.campus.venue.security.VenueScopeGuard;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * AppUser → UserProfile（BE-6 U1–U4）：VENUE_ADMIN 的 venueIds 为当前有效授权（升序，同 /auth/me），其他角色为 null。
 * 列表的 venueIds 一次批量装载。事务由调用方提供。
 */
@Component
public class UserProfiles {

    private final VenueScopeGuard venueScopeGuard;

    public UserProfiles(VenueScopeGuard venueScopeGuard) {
        this.venueScopeGuard = venueScopeGuard;
    }

    public UserProfile of(AppUser user) {
        List<Long> venueIds = user.getRole() == Role.VENUE_ADMIN
                ? venueScopeGuard.effectiveVenueIds(user.getId())
                : null;
        return UserProfileMapper.toProfile(user, venueIds);
    }

    public List<UserProfile> of(List<AppUser> users) {
        Map<Long, List<Long>> venueIds = venueScopeGuard.effectiveVenueIdsByAdmin(users.stream()
                .filter(user -> user.getRole() == Role.VENUE_ADMIN).map(AppUser::getId).toList());
        return users.stream().map(user -> UserProfileMapper.toProfile(user,
                user.getRole() == Role.VENUE_ADMIN ? venueIds.get(user.getId()) : null)).toList();
    }
}
