package com.campus.venue.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;

/** T2：护栏只放行库名以 _test 结尾的库。这里只模拟库名查询，不触碰任何真实数据库。 */
class TestDatabaseGuardTest {

    private static DataSource dataSourceNamed(String databaseName) throws SQLException {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        Statement statement = mock(Statement.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery("select current_database()")).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString(1)).thenReturn(databaseName);
        return dataSource;
    }

    @Test
    void rejectsADatabaseWhoseNameDoesNotEndWithTest() throws SQLException {
        DataSource dev = dataSourceNamed("venue_booking");

        assertThatThrownBy(() -> TestDatabaseGuard.require(dev))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("venue_booking");
    }

    @Test
    void rejectsANameThatMerelyContainsTest() throws SQLException {
        DataSource tricky = dataSourceNamed("venue_test_prod");

        assertThatThrownBy(() -> TestDatabaseGuard.require(tricky)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void acceptsTheTestDatabase() throws SQLException {
        DataSource test = dataSourceNamed("venue_booking_test");

        assertThatCode(() -> TestDatabaseGuard.require(test)).doesNotThrowAnyException();
        assertThat(TestDatabaseGuard.currentDatabase(test)).isEqualTo("venue_booking_test");
    }

    @Test
    void refusesWhenTheDatabaseNameCannotBeDetermined() throws SQLException {
        DataSource broken = mock(DataSource.class);
        when(broken.getConnection()).thenThrow(new SQLException("连接失败"));

        assertThatThrownBy(() -> TestDatabaseGuard.require(broken)).isInstanceOf(IllegalStateException.class);
    }
}
