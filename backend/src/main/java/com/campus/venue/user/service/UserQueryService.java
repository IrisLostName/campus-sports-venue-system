package com.campus.venue.user.service;

import com.campus.venue.auth.dto.UserProfile;
import com.campus.venue.common.LikePattern;
import com.campus.venue.common.dto.DatabasePaging;
import com.campus.venue.common.dto.PageView;
import com.campus.venue.common.repository.SpecificationPages;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 系统管理员的用户列表（docs/12 第 5.9 节，BE-6 U1），与 mock userService.ts 的 listUsers 一致。 */
@Service
public class UserQueryService {

    private static final char ESCAPE = '\\';
    private static final Sort BY_ID = Sort.by(Sort.Direction.ASC, "id");

    private final AppUserRepository users;
    private final SpecificationPages pages;
    private final UserProfiles profiles;

    public UserQueryService(AppUserRepository users, SpecificationPages pages, UserProfiles profiles) {
        this.users = users;
        this.pages = pages;
        this.profiles = profiles;
    }

    /**
     * role 过滤；keyword 去首尾空白后不区分大小写、字面包含匹配用户名或姓名（空白视为未填，BE-6 C6）；按 id 升序，
     * 数据库分页。VENUE_ADMIN 的 venueIds 批量装载。
     */
    @Transactional(readOnly = true)
    public PageView<UserProfile> list(Role role, String keyword, int page, int pageSize) {
        String pattern = LikePattern.contains(keyword);
        Specification<AppUser> spec = (root, query, cb) -> {
            List<Predicate> list = new ArrayList<>();
            if (role != null) {
                list.add(cb.equal(root.get("role"), role));
            }
            if (pattern != null) {
                Expression<String> lowered = cb.lower(cb.literal(pattern));
                list.add(cb.or(cb.like(cb.lower(root.get("username")), lowered, ESCAPE),
                        cb.like(cb.lower(root.get("displayName")), lowered, ESCAPE)));
            }
            return cb.and(list.toArray(Predicate[]::new));
        };
        return DatabasePaging.page(page, pageSize, BY_ID, () -> users.count(spec),
                request -> pages.find(AppUser.class, spec, request), profiles::of);
    }
}
