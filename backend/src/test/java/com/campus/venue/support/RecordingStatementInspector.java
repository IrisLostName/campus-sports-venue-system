package com.campus.venue.support;

import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import org.hibernate.resource.jdbc.spi.StatementInspector;

/**
 * 记录 Hibernate 实际发出的 SQL（TEST-1 P1：证明锁子句）。只在声明了
 * spring.jpa.properties.hibernate.session_factory.statement_inspector 的测试类自己的上下文中启用，不改主配置。
 */
public class RecordingStatementInspector implements StatementInspector {

    private static final Queue<String> STATEMENTS = new ConcurrentLinkedQueue<>();

    @Override
    public String inspect(String sql) {
        STATEMENTS.add(sql);
        return sql;
    }

    public static void clear() {
        STATEMENTS.clear();
    }

    /** 记录到的、包含 fragment（忽略大小写）的语句。 */
    public static List<String> containing(String fragment) {
        String lower = fragment.toLowerCase();
        return STATEMENTS.stream().filter(sql -> sql.toLowerCase().contains(lower)).toList();
    }
}
