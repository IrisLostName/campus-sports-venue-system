package com.campus.venue.auth.service;

import com.campus.venue.auth.domain.PasswordResetAttempt;
import com.campus.venue.auth.dto.PasswordResetRequest;
import com.campus.venue.auth.repository.PasswordResetAttemptRepository;
import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.user.repository.AppUserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 自助找回密码（docs/12 第 5.1 节、docs/10 第 4a 节，SEC-2b）。格式在控制器完成；本类按“锁定 → 核对 → 执行”进行。
 * 尝试按请求中的用户名字符串计数，不论账号是否存在；不存在、非 USER、停用、未登记手机号、姓名或手机号不符一律
 * RESET_INFO_MISMATCH，剩余次数与锁定行为完全相同（SEC-2b 裁决第 2 条）。不记录任何日志。
 */
@Service
public class PasswordResetService {

    /** 24 小时内至多失败的次数（契约固定值，SEC-2b 裁决 Q7）。 */
    static final int MAX_FAILURES = 7;
    /** 计数窗口。 */
    static final Duration WINDOW = Duration.ofHours(24);

    private final AppUserRepository users;
    private final PasswordResetAttemptRepository attempts;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public PasswordResetService(AppUserRepository users, PasswordResetAttemptRepository attempts,
            PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.attempts = attempts;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /**
     * 先对用户名字符串取咨询锁（同一用户名的并发尝试串行）→ 计入的失败已达 7 → PASSWORD_RESET_LOCKED
     * {unlocksAt = 最早一次计入的失败 + 24 小时}（本次不记录、不核对）→ 加锁读取账号并逐字核对 → 不符：记一条失败后
     * RESET_INFO_MISMATCH {remainingAttempts}；相符：更新哈希、password_changed_at（截到整秒，早于它签发的 Token 失效）、
     * updated_at，记一条成功。
     * <p>失败行必须在错误响应后保留，所以只对本方法声明 noRollbackFor = BusinessException（SEC-2b 裁决 Q1）：
     * 抛出业务异常之前唯一的写入就是那一条尝试记录，锁定检查在任何写入之前抛出。
     * 读取账号用 FOR NO KEY UPDATE 锁，避免与系统管理员同时停用该账号时把旧状态写回。
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public void reset(PasswordResetRequest request) {
        String username = request.username();
        attempts.lockUsername(username);
        LocalDateTime now = LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
        PasswordResetAttemptRepository.CountedFailures counted = attempts.countedFailures(username, now.minus(WINDOW));
        if (counted.getFailures() >= MAX_FAILURES) {
            throw new BusinessException(ErrorCode.PASSWORD_RESET_LOCKED,
                    Map.of("unlocksAt", counted.getEarliest().plus(WINDOW)));
        }
        Optional<AppUser> matched = users.lockByUsername(username).filter(user -> matches(user, request));
        if (matched.isEmpty()) {
            attempts.saveAndFlush(new PasswordResetAttempt(username, now, false));
            int remaining = MAX_FAILURES - (int) counted.getFailures() - 1;
            throw new BusinessException(ErrorCode.RESET_INFO_MISMATCH, Map.of("remainingAttempts", remaining));
        }
        AppUser user = matched.get();
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangedAt(now);
        user.setUpdatedAt(now);
        attempts.save(new PasswordResetAttempt(username, now, true));
    }

    /** 四项都满足才算对上：ACTIVE、角色 USER、已登记手机号、姓名与手机号逐字相同（不去空白、区分大小写）。 */
    private static boolean matches(AppUser user, PasswordResetRequest request) {
        return user.getStatus() == AccountStatus.ACTIVE
                && user.getRole() == Role.USER
                && user.getPhone() != null
                && user.getDisplayName().equals(request.displayName())
                && user.getPhone().equals(request.phone());
    }
}
