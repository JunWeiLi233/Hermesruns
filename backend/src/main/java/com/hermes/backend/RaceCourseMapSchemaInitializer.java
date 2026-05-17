package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

@Configuration
public class RaceCourseMapSchemaInitializer {
    private static final Logger log = LoggerFactory.getLogger(RaceCourseMapSchemaInitializer.class);
    private static final String RACE_COURSE_MAP_ASSET_TABLE = "race_course_map_asset";

    @Bean
    ApplicationRunner raceCourseMapSchemaCompatibilityRunner(JdbcTemplate jdbcTemplate) {
        return args -> ensureLocalRouteColumns(jdbcTemplate);
    }

    void ensureLocalRouteColumns(JdbcTemplate jdbcTemplate) {
        if (!tableExists(jdbcTemplate, RACE_COURSE_MAP_ASSET_TABLE)) {
            return;
        }
        addColumnIfMissing(jdbcTemplate, "local_route_artifact_ref", "text");
        addColumnIfMissing(jdbcTemplate, "local_route_updated_at", "timestamp");
        addColumnIfMissing(jdbcTemplate, "local_route_updated_by_email", "varchar(255)");
    }

    private boolean tableExists(JdbcTemplate jdbcTemplate, String tableName) {
        Boolean exists = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metaData = connection.getMetaData();
            for (String candidate : identifierCandidates(tableName)) {
                try (ResultSet tables = metaData.getTables(null, null, candidate, new String[]{"TABLE"})) {
                    if (tables.next()) {
                        return true;
                    }
                }
            }
            return false;
        });
        return Boolean.TRUE.equals(exists);
    }

    private void addColumnIfMissing(JdbcTemplate jdbcTemplate, String columnName, String columnType) {
        if (columnExists(jdbcTemplate, RACE_COURSE_MAP_ASSET_TABLE, columnName)) {
            return;
        }
        jdbcTemplate.execute("alter table race_course_map_asset add column " + columnName + " " + columnType);
        log.info("[Hermes] Added missing race_course_map_asset.{} compatibility column.", columnName);
    }

    private boolean columnExists(JdbcTemplate jdbcTemplate, String tableName, String columnName) {
        Boolean exists = jdbcTemplate.execute((ConnectionCallback<Boolean>) connection -> {
            DatabaseMetaData metaData = connection.getMetaData();
            for (String tableCandidate : identifierCandidates(tableName)) {
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
