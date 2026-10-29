package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.dto.Companion;
import com.campus.venue.security.AuthenticatedUser;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 查找同行人（docs/12 第 5.3 节 GET /users/lookup，契约 v1.2，P2-2b）。只做精确匹配：先按用户名，没有合格的用户名匹配
 * 再按手机号；合格 = ACTIVE、角色 USER、不是本人（裁决第 5 节第 1、2 条，手机号多人匹配也只计合格用户）。
 * q 按原样匹配、不去空白（第 3 条）。没有或多于一个匹配一律 NOT_FOUND，不区分原因；只返回 userId 与 displayName。
 */
@Service
public class CompanionLookupService {

    private final AppUserRepository users;

    public CompanionLookupService(AppUserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Companion lookup(AuthenticatedUser user, String q) {
        Optional<AppUser> byUsername = users.findByUsernameAndRoleAndStatusAndIdNot(q, Role.USER,
                AccountStatus.ACTIVE, user.id());
        if (byUsername.isPresent()) {
            return toCompanion(byUsername.get());
        }
        List<AppUser> byPhone = users.findTop2ByPhoneAndRoleAndStatusAndIdNotOrderByIdAsc(q, Role.USER,
                AccountStatus.ACTIVE, user.id());
        if (byPhone.size() != 1) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return toCompanion(byPhone.get(0));
    }

    private static Companion toCompanion(AppUser found) {
        return new Companion(found.getId(), found.getDisplayName());
    }
}
