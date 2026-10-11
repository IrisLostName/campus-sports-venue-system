package com.campus.venue.support;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;

/**
 * 测试库护栏：只有当前库名以 _test 结尾时才允许清库或截断，否则立即失败。
 */
public final class TestDatabaseGuard {

    private static final String TEST_SUFFIX = "_test";

    private TestDatabaseGuard() {
    }

    /** 当前连接的库名不以 _test 结尾时抛出 IllegalStateException。 */
    public static void require(DataSource dataSource) {
        String name = currentDatabase(dataSource);
        if (!name.endsWith(TEST_SUFFIX)) {
            throw new IllegalStateException("拒绝清理非测试库：当前库名为 " + name + "，库名必须以 " + TEST_SUFFIX + " 结尾");
        }
    }

    static String currentDatabase(DataSource dataSource) {
        try (Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("select current_database()")) {
            result.next();
            return result.getString(1);
        } catch (SQLException e) {
            throw new IllegalStateException("无法确认当前库名，拒绝继续", e);
        }
    }
}
