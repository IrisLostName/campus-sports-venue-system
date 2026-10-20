package com.campus.venue.user.repository;

import com.campus.venue.user.domain.AppUser;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 用户数据访问。用户名区分大小写（与库约束一致）。管理端列表的动态条件见 UserQueryService（Specification，BE-6 U1）。 */
public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {

    Optional<AppUser> findByUsername(String username);

    boolean existsByUsername(String username);

    /**
     * 锁定用户行（PESSIMISTIC_WRITE；Hibernate 6 在 PostgreSQL 上发出 SELECT … FOR NO KEY UPDATE）：同一用户的并发创建预约、
     * 同一目标用户的 PATCH 与授权替换在此串行化（BE-3 C4、BE-6），锁随事务结束释放。它与外键检查的 FOR KEY SHARE 兼容，
     * 所以两个 SYS_ADMIN 同时互相停用不会死锁（TEST-1 K3，MutualDisableTest）。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AppUser u where u.id = :id")
    Optional<AppUser> lockById(@Param("id") Long id);
}
