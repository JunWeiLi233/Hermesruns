package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RaceCourseMapSchemaInitializerTests {
    @Test
    void ensureLocalRouteColumnsAddsMissingColumnsAndIsIdempotent() {
        JdbcTemplate jdbcTemplate = jdbcTemplate("schema-columns");
        jdbcTemplate.execute("create table race_course_map_asset (id bigint primary key)");

        RaceCourseMapSchemaInitializer initializer = new RaceCourseMapSchemaInitializer();
        initializer.ensureLocalRouteColumns(jdbcTemplate);
        initializer.ensureLocalRouteColumns(jdbcTemplate);

        assertThat(columnExists(jdbcTemplate, "local_route_artifact_ref")).isTrue();
        assertThat(columnExists(jdbcTemplate, "local_route_updated_at")).isTrue();
        assertThat(columnExists(jdbcTemplate, "local_route_updated_by_email")).isTrue();
    }

    @Test
    void ensureLocalRouteColumnsSkipsWhenCourseMapTableDoesNotExist() {
        JdbcTemplate jdbcTemplate = jdbcTemplate("schema-no-table");

        new RaceCourseMapSchemaInitializer().ensureLocalRouteColumns(jdbcTemplate);

        assertThat(tableExists(jdbcTemplate)).isFalse();
    }

    private JdbcTemplate jdbcTemplate(String name) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:" + name + ";MODE=PostgreSQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        return new JdbcTemplate(dataSource);
    }

    private boolean tableExists(JdbcTemplate jdbcTemplate) {
        Boolean exists = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metaData = connection.getMetaData();
            for (String tableCandidate : identifierCandidates("race_course_map_asset")) {
                try (ResultSet tables = metaData.getTables(null, null, tableCandidate, new String[]{"TABLE"})) {
                    if (tables.next()) {
                        return true;
                    }
                }
            }
            return false;
        });
        return Boolean.TRUE.equals(exists);
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String columnName) {
        Boolean exists = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metaData = connection.getMetaData();
            for (String tableCandidate : identifierCandidates("race_course_map_asset")) {
                for (String columnCandidate : identifierCandidates(columnName)) {
                    if (hasColumn(metaData, tableCandidate, columnCandidate)) {
                        return true;
                    }
                }
            }
            return false;
        });
        return Boolean.TRUE.equals(exists);
    }

    private boolean hasColumn(DatabaseMetaData metaData, String tableName, String columnName) throws SQLException {
        try (ResultSet columns = metaData.getColumns(null, null, tableName, columnName)) {
            return columns.next();
        }
    }

    private Set<String> identifierCandidates(String identifier) {
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        candidates.add(identifier);
        candidates.add(identifier.toUpperCase(Locale.ROOT));
        candidates.add(identifier.toLowerCase(Locale.ROOT));
        return candidates;
    }
}
