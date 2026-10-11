package com.campus.venue.security;

import com.campus.venue.user.domain.Role;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** 当前登录用户（安全上下文中的 principal）。角色取自数据库的当前值，不取令牌中的 role（J4）。 */
public record AuthenticatedUser(long id, String username, Role role) {

    public List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
}
