package com.campus.venue.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Future;
import javax.sql.DataSource;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 持锁方（TEST-1，沿用 BE-5 AdminOverrideLockTest 的做法）：测试线程上一个独立的 JDBC 事务，先锁住行或表，
 * 再由有截止时间的循环查询 pg_stat_activity / pg_blocking_pids 确认被测请求正在等它的锁（每次循环是一次真实的
 * 数据库往返，不用 sleep），最后提交或回滚放行。另提供 NOWAIT 探测：确认某行此刻被别的事务锁住（SQLState 55P03）。
 */
public final class LockHolder implements AutoCloseable {

    public static final Duration WAIT_DEADLINE = Duration.ofSeconds(20);
    private static final String LOCK_NOT_AVAILABLE = "55P03";

    private final Connection connection;
    private final JdbcTemplate jdbc;
    private final long pid;

    private LockHolder(Connection connection, JdbcTemplate jdbc) throws SQLException {
        this.connection = connection;
        this.jdbc = jdbc;
        connection.setAutoCommit(false);
        try (PreparedStatement statement = connection.prepareStatement("select pg_backend_pid()");
                ResultSet rows = statement.executeQuery()) {
            assertThat(rows.next()).isTrue();
            this.pid = rows.getLong(1);
        }
    }

    /** 从连接池取一个连接作为持锁方；jdbc 用于在其他连接上观察等待。 */
    public static LockHolder open(DataSource dataSource, JdbcTemplate jdbc) throws SQLException {
        return new LockHolder(dataSource.getConnection(), jdbc);
    }

    /** 在持锁方事务里锁住 table 中 id 对应的行（SELECT … FOR UPDATE）。 */
    public void lockRow(String table, long id) throws SQLException {
        String sql = "select id from " + table + " where id = ? for update";
        try (PreparedStatement lock = connection.prepareStatement(sql)) {
            lock.setLong(1, id);
            try (ResultSet rows = lock.executeQuery()) {
                assertThat(rows.next()).as(table + " " + id).isTrue();
            }
        }
    }

    /** 在持锁方事务里执行一条语句，返回影响的行数（非 DML 为 0）。 */
    public int execute(String sql, Object... args) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) {
                statement.setObject(i + 1, args[i]);
            }
            statement.execute();
            return Math.max(statement.getUpdateCount(), 0);
        }
    }

    public void commit() throws SQLException {
        connection.commit();
    }

    public void rollback() throws SQLException {
        connection.rollback();
    }

    /** 直到至少 count 个后端在等持锁方的锁；任一待等请求提前结束或超过截止时间都算失败。 */
    public void awaitBlocked(int count, List<? extends Future<?>> pending) {
        long deadline = System.nanoTime() + WAIT_DEADLINE.toNanos();
        while (System.nanoTime() < deadline) {
            for (Future<?> future : pending) {
                assertThat(future.isDone()).as("请求未等待持锁方的锁就已结束").isFalse();
            }
            if (blockedQueries().size() >= count) {
                return;
            }
        }
        throw new AssertionError("截止时间内没有 " + count + " 个请求在等待持锁方的锁");
    }

    public void awaitBlocked(Future<?> pending) {
        awaitBlocked(1, List.of(pending));
    }

    /** 此刻正在等持锁方的锁的各后端当前执行的语句。 */
    public List<String> blockedQueries() {
        return jdbc.queryForList("select query from pg_stat_activity where wait_event_type = 'Lock'"
                + " and ? = any(pg_blocking_pids(pid)) order by pid", String.class, pid);
    }

    /** 在另一个连接上以 NOWAIT 尝试锁 table 中 id 对应的行，断言它此刻被别的事务锁住（55P03）。 */
    public static void assertRowLockedElsewhere(JdbcTemplate jdbc, String table, long id) {
        Throwable thrown = catchThrowable(() -> jdbc.queryForList("select id from " + table
                + " where id = ? for update nowait", id));
        assertThat(thrown).as(table + " " + id + " 应已被锁住").isInstanceOf(DataAccessException.class);
        Throwable cause = ((DataAccessException) thrown).getMostSpecificCause();
        assertThat(cause).isInstanceOf(SQLException.class);
        assertThat(((SQLException) cause).getSQLState()).isEqualTo(LOCK_NOT_AVAILABLE);
    }

    @Override
    public void close() throws SQLException {
        try {
            if (!connection.getAutoCommit()) {
                connection.rollback();
            }
        } finally {
            connection.setAutoCommit(true);
            connection.close();
        }
    }
}
