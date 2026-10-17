package com.campus.venue.user.service;

import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.repository.AppUserRepository;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** 按 id 批量取用户姓名（BE-6 公告发布者、报修人、日志操作者）：一次查询，列表无 N+1。空集合不发查询。 */
@Component
public class DisplayNames {

    private final AppUserRepository users;

    public DisplayNames(AppUserRepository users) {
        this.users = users;
    }

    public Map<Long, String> of(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(new HashSet<>(ids)).stream()
                .collect(Collectors.toMap(AppUser::getId, AppUser::getDisplayName, (first, second) -> first));
    }
}
