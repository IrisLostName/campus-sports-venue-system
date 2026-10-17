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

    /** 锁定用户行（SELECT … FOR UPDATE）：同一用户的并发创建预约在此串行化（BE-3 C4），锁随事务结束释放。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AppUser u where u.id = :id")
    Optional<AppUser> lockById(@Param("id") Long id);
}
