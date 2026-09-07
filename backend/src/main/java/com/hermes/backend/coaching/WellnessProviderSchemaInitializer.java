package com.hermes.backend.coaching;

import java.sql.Connection;
import java.util.List;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/** Hibernate schema update does not expand existing string-enum constraints. */
@Configuration
public class WellnessProviderSchemaInitializer {
    private static final List<String> TABLES = List.of(
            "daily_sleep_data", "daily_hrv_data", "daily_wellness_summary", "daily_stress_data");

    @Bean
    @DependsOn("entityManagerFactory")
    InitializingBean wellnessProviderSchemaCompatibility(JdbcTemplate jdbc) {
        return () -> allowManualProvider(jdbc);
    }

    void allowManualProvider(JdbcTemplate jdbc) {
        String database = jdbc.execute((ConnectionCallback<String>) c -> c.getMetaData().getDatabaseProductName());
        String schema = jdbc.execute((ConnectionCallback<String>) Connection::getSchema);
        if ("PostgreSQL".equals(database)) {
            for (String table : TABLES) upgradePostgres(jdbc, schema, table);
        } else if ("H2".equals(database)) {
            for (String table : TABLES) upgradeH2(jdbc, schema, table);
        }
    }

    private void upgradePostgres(JdbcTemplate jdbc, String schema, String table) {
        var constraints = jdbc.queryForList("""
                SELECT c.conname AS name, pg_get_expr(c.conbin, c.conrelid) AS predicate
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = 'provider'
                WHERE n.nspname = ? AND t.relname = ? AND c.contype = 'c'
                  AND c.conkey = ARRAY[a.attnum]
                """, schema, table);
        for (var constraint : constraints) {
            String predicate = (String) constraint.get("predicate");
            if (!isLegacyProviderCheck(predicate)) continue;
            String name = quote((String) constraint.get("name"));
            // One atomic ALTER retains the old condition and accepts exactly one
            // additional provider; other checks and NOT NULL remain untouched.
            jdbc.execute("ALTER TABLE " + quote(schema) + "." + quote(table)
                    + " DROP CONSTRAINT " + name + ", ADD CONSTRAINT " + name
                    + " CHECK ((" + predicate + ") OR provider = 'MANUAL')");
        }
    }

    private void upgradeH2(JdbcTemplate jdbc, String schema, String table) {
        var columns = jdbc.queryForList("""
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DTD_IDENTIFIER, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = ? AND LOWER(COLUMN_NAME) = 'provider'
                """, schema, table);
        if (columns.isEmpty()) return;
        var column = columns.get(0);
        String actualTable = (String) column.get("TABLE_NAME");
        String actualColumn = (String) column.get("COLUMN_NAME");
        String qualified = quote(schema) + "." + quote(actualTable);
        if ("ENUM".equals(column.get("DATA_TYPE"))) {
            var values = jdbc.queryForList("""
                    SELECT VALUE_NAME FROM INFORMATION_SCHEMA.ENUM_VALUES
                    WHERE OBJECT_SCHEMA = ? AND OBJECT_NAME = ? AND ENUM_IDENTIFIER = ?
                    ORDER BY VALUE_ORDINAL
                    """, String.class, schema, actualTable, column.get("DTD_IDENTIFIER"));
            if (!values.contains("MANUAL")) {
                var literals = new java.util.ArrayList<>(values.stream().map(this::literal).toList());
                literals.add("'MANUAL'");
                jdbc.execute("ALTER TABLE " + qualified + " ALTER COLUMN " + quote(actualColumn)
                        + " ENUM(" + String.join(",", literals) + ")"
                        + ("NO".equals(column.get("IS_NULLABLE")) ? " NOT NULL" : ""));
            }
        }
        var constraints = jdbc.queryForList("""
                SELECT c.CONSTRAINT_NAME AS name, c.CHECK_CLAUSE AS predicate
                FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS c
                JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS t
                  ON t.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME = c.CONSTRAINT_NAME
                WHERE t.TABLE_SCHEMA = ? AND t.TABLE_NAME = ?
                  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE u
                       WHERE u.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA AND u.CONSTRAINT_NAME = c.CONSTRAINT_NAME) = 1
                  AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE u
                       WHERE u.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA AND u.CONSTRAINT_NAME = c.CONSTRAINT_NAME
                         AND LOWER(u.COLUMN_NAME) = 'provider')
                """, schema, actualTable);
        for (var constraint : constraints) {
            String predicate = (String) constraint.get("predicate");
            if (!isLegacyProviderCheck(predicate)) continue;
            String name = (String) constraint.get("name");
            String replacementName = name + "_manual";
            String replacementPredicate = "(" + predicate + ") OR " + quote(actualColumn) + " = 'MANUAL'";
            // H2 commits DDL implicitly: add the replacement before removing the
            // old check, so there is never a window without validation.
            var previousAttempt = jdbc.queryForList("""
                    SELECT CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
                    WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?
                    """, String.class, schema, replacementName);
            if (previousAttempt.isEmpty()) {
                jdbc.execute("ALTER TABLE " + qualified + " ADD CONSTRAINT " + quote(replacementName)
                        + " CHECK (" + replacementPredicate + ")");
            } else if (!isExpectedReplacement(previousAttempt.get(0), predicate, actualColumn, replacementPredicate)) {
                throw new IllegalStateException("Unexpected existing wellness provider constraint: " + replacementName);
            }
            jdbc.execute("ALTER TABLE " + qualified + " DROP CONSTRAINT " + quote(name));
        }
    }

    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private static boolean isLegacyProviderCheck(String predicate) {
        return !predicate.contains("'MANUAL'")
                && predicate.contains("'GARMIN'") && predicate.contains("'STRAVA'");
    }

    private static String normalizedCheck(String predicate) {
        // H2 reformats parentheses and whitespace when exposing a stored check.
        return predicate.replaceAll("\\s+", "").replace("(", "").replace(")", "");
    }

    private static boolean isExpectedReplacement(String existing, String original, String column, String expected) {
        if (normalizedCheck(existing).equals(normalizedCheck(expected))) return true;
        // H2 can fold the OR into the IN list and reorder its constants.
        var originalValues = inValues(original, column);
        var existingValues = inValues(existing, column);
        if (originalValues == null || existingValues == null) return false;
        originalValues.add("MANUAL");
        return originalValues.equals(existingValues);
    }

    private static java.util.Set<String> inValues(String predicate, String column) {
        var matcher = java.util.regex.Pattern.compile("^[\\s(]*" + java.util.regex.Pattern.quote(quote(column))
                + "\\s+IN\\s*\\(([^()]*)\\)[\\s)]*$").matcher(predicate);
        if (!matcher.matches()) return null;
        String values = matcher.group(1).trim();
        if (!values.matches("'[A-Z_]+'(?:\\s*,\\s*'[A-Z_]+')*")) return null;
        return new java.util.HashSet<>(java.util.Arrays.stream(values.split(","))
                .map(String::trim).map(value -> value.substring(1, value.length() - 1)).toList());
    }

    private String literal(String value) {
        return "'" + value.replace("'", "''") + "'";
    }
}
