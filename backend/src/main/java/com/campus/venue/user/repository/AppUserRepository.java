package com.campus.venue.user.repository;

import com.campus.venue.user.domain.AccountStatus;
import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 用户数据访问。用户名区分大小写（与库约束一致）。管理端列表的动态条件见 UserQueryService（Specification，BE-6 U1）。 */
public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {

    Optional<AppUser> findByUsername(String username);

    boolean existsByUsername(String username);

    /** 查找同行人（GET /users/lookup，P2-2b）：按用户名精确匹配（区分大小写）合格的用户——指定角色与状态、不是 id 本人。 */
    Optional<AppUser> findByUsernameAndRoleAndStatusAndIdNot(String username, Role role, AccountStatus status, Long id);

    /** 查找同行人：按手机号精确匹配合格的用户；最多取 2 个，调用方只需判断是否恰好一个。 */
    List<AppUser> findTop2ByPhoneAndRoleAndStatusAndIdNotOrderByIdAsc(String phone, Role role, AccountStatus status,
            Long id);

    /**
     * 锁定用户行（PESSIMISTIC_WRITE；Hibernate 6 在 PostgreSQL 上发出 SELECT … FOR NO KEY UPDATE）：同一用户的并发创建预约、
     * 同一目标用户的 PATCH 与授权替换在此串行化（BE-3 C4、BE-6），锁随事务结束释放。它与外键检查的 FOR KEY SHARE 兼容，
     * 所以两个 SYS_ADMIN 同时互相停用不会死锁（TEST-1 K3，MutualDisableTest）。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AppUser u where u.id = :id")
    Optional<AppUser> lockById(@Param("id") Long id);

    /**
     * 用户的随机签到标识（docs/13 第 3.1 节 check_in_uuid，P2-1b）。实体不映射该列，所以它不会随任何视图返回；
     * 该列建立后不再修改，读取不加锁。
     */
    @Query(value = "select check_in_uuid from app_user where id = :id", nativeQuery = true)
    Optional<UUID> findCheckInUuidById(@Param("id") long id);
}
