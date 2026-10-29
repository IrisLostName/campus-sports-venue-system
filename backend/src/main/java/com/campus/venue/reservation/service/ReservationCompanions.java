package com.campus.venue.reservation.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.reservation.domain.ReservationCompanion;
import com.campus.venue.reservation.repository.ReservationCompanionRepository;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.springframework.stereotype.Component;

/**
 * 创建预约时的同行人名单（契约 v1.2，P2-2b）：步骤 8a 的业务检查与第 9 步的写入。格式（至多 6、正整数、不重复、不含本人）
 * 已在格式阶段由 CompanionUserIds 校验。事务由调用方提供。
 * 同行人的用户行不加锁：加锁顺序（用户 → 场馆 → 预约）里只有预约人自己的行，两人互加对方时加锁会死锁；
 * 检查之后、提交之前同行人被停用的短暂窗口与 BE-2b/BE-5 已登记的竞态同类。
 */
@Component
public class ReservationCompanions {

    /** 步骤 8a 的字段文案：不区分不存在、停用、非 USER。 */
    static final String INELIGIBLE = "包含无效的用户";

    private final AppUserRepository users;
    private final ReservationCompanionRepository companions;

    public ReservationCompanions(AppUserRepository users, ReservationCompanionRepository companions) {
        this.users = users;
        this.companions = companions;
    }

    /** 步骤 8a：每个 id 都是存在、ACTIVE、角色为 USER 的用户 → 否则 VALIDATION_ERROR fields.companionUserIds。一次查询。 */
    public void requireEligible(List<Long> ids) {
        if (ids.isEmpty()) {
            return;
        }
        List<AppUser> found = users.findAllById(ids);
        boolean allEligible = found.size() == ids.size() && found.stream()
                .allMatch(user -> user.getRole() == Role.USER && user.getStatus() == AccountStatus.ACTIVE);
        if (!allEligible) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    Map.of("fields", Map.of("companionUserIds", INELIGIBLE)));
        }
    }

    /** 第 9 步：按提交顺序写入，position 从 1 开始。 */
    public void insert(long reservationId, List<Long> ids) {
        companions.saveAll(IntStream.range(0, ids.size())
                .mapToObj(index -> new ReservationCompanion(reservationId, ids.get(index), index + 1)).toList());
        companions.flush();
    }
}
