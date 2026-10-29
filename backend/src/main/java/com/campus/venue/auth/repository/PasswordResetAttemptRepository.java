package com.campus.venue.auth.repository;

import com.campus.venue.auth.domain.PasswordResetAttempt;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 找回密码尝试记录（SEC-2b）。按请求中的用户名字符串计数，与账号是否存在无关。 */
public interface PasswordResetAttemptRepository extends JpaRepository<PasswordResetAttempt, Long> {

    /**
     * 事务级咨询锁（随事务结束释放），使同一用户名字符串的“计数 → 记录”串行，并发尝试不能越过上限。
     * 第一个键 103 只是本功能的命名空间（取自迁移 V103）；不同用户名的 hashtext 碰撞只会让它们互相等待，不影响计数。
     */
    @Query(value = "select count(*) from pg_advisory_xact_lock(103, hashtext(:username))", nativeQuery = true)
    long lockUsername(@Param("username") String username);

    /** 计入的失败：次数与最早时刻（没有时 earliest 为 null）。 */
    interface CountedFailures {

        long getFailures();

        LocalDateTime getEarliest();
    }

    /**
     * 计入的失败 = 该用户名 attempted_at 晚于 since（现在减 24 小时）、且 id 大于其最近一次成功的 id 的失败行。
     * “最近一次成功之后”按 id 判断而不按时刻：咨询锁下 id 顺序即处理顺序，同一秒内的先后也不会混淆。
     */
    @Query("""
            select count(a) as failures, min(a.attemptedAt) as earliest from PasswordResetAttempt a
            where a.username = :username and a.succeeded = false and a.attemptedAt > :since
              and a.id > coalesce((select max(s.id) from PasswordResetAttempt s
                                   where s.username = :username and s.succeeded = true), 0L)
            """)
    CountedFailures countedFailures(@Param("username") String username, @Param("since") LocalDateTime since);
}
