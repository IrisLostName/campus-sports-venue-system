package com.campus.venue.support;

import com.campus.venue.user.domain.AppUser;
import com.campus.venue.user.domain.Role;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueType;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDateTime;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 实体往返测试基类：每个用例前截断业务表；写入与读取各在独立事务内，
 * 读取时是全新的持久化上下文，保证值确实来自数据库。
 */
@IntegrationTest
public abstract class AbstractEntityTest {

    /** 固定的“当前时间”，整秒，避免精度差异。 */
    protected static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 12, 8, 30, 15);

    @PersistenceContext
    protected EntityManager em;

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private TransactionTemplate transaction;

    @BeforeEach
    void cleanTables() {
        DatabaseCleaner.truncateAll(dataSource);
        transaction = new TransactionTemplate(transactionManager);
    }

    protected <T> T persist(T entity) {
        transaction.executeWithoutResult(status -> em.persist(entity));
        return entity;
    }

    protected <T> T reload(Class<T> type, Long id) {
        return transaction.execute(status -> em.find(type, id));
    }

    protected String text(String sql, Object... args) {
        return jdbc.queryForObject(sql, String.class, args);
    }

    protected AppUser newUser(String username, Role role) {
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash("hash-" + username);
        user.setDisplayName("用户" + username);
        user.setRole(role);
        user.setCreatedAt(NOW);
        user.setUpdatedAt(NOW);
        return persist(user);
    }

    protected Venue newVenue(String name) {
        Venue venue = new Venue();
        venue.setName(name);
        venue.setVenueType(VenueType.TENNIS);
        venue.setCreatedAt(NOW);
        venue.setUpdatedAt(NOW);
        return persist(venue);
    }

    protected Resource newResource(Venue venue, String name) {
        Resource resource = new Resource();
        resource.setVenueId(venue.getId());
        resource.setName(name);
        resource.setCreatedAt(NOW);
        resource.setUpdatedAt(NOW);
        return persist(resource);
    }
}
