package com.hermes.backend.coaching;

import java.sql.Connection;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class WellnessProviderSchemaInitializerTests {
    private static final List<String> TABLES = List.of(
            "daily_sleep_data", "daily_hrv_data", "daily_wellness_summary", "daily_stress_data");

    @Test
    void upgradesExistingH2ChecksWithoutDroppingValidation() throws Exception {
        try (Connection connection = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID(), "sa", "").getConnection()) {
            verifyLegacyChecks(new JdbcTemplate(new SingleConnectionDataSource(connection, true)));
        }
    }

    @Test
    void resumesInterruptedH2UpgradeWithReplacementAlreadyPresent() throws Exception {
        try (Connection connection = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID(), "sa", "").getConnection()) {
            verifyLegacyChecks(new JdbcTemplate(new SingleConnectionDataSource(connection, true)), true);
        }
    }

    @Test
    void refusesAnUnexpectedReplacementInsteadOfWeakeningValidation() throws Exception {
        try (Connection connection = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID(), "sa", "").getConnection()) {
            JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            jdbc.execute("CREATE TABLE daily_sleep_data (provider VARCHAR(32), CONSTRAINT legacy_check CHECK (provider IN ('GARMIN','STRAVA')))");
            jdbc.execute("ALTER TABLE daily_sleep_data ADD CONSTRAINT \"LEGACY_CHECK_manual\" CHECK (provider IN ('GARMIN','STRAVA','MANUAL','UNKNOWN'))");
            assertThatThrownBy(() -> new WellnessProviderSchemaInitializer().allowManualProvider(jdbc))
                    .isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(() -> jdbc.update("INSERT INTO daily_sleep_data VALUES ('UNKNOWN')"))
                    .isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Test
    void upgradesH2NativeEnumsAndPreservesRowsAndNullability() {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE TABLE daily_sleep_data (id INT PRIMARY KEY, provider ENUM('GARMIN','STRAVA') NOT NULL)");
        jdbc.update("INSERT INTO daily_sleep_data VALUES (1, 'GARMIN')");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO daily_sleep_data VALUES (2, 'MANUAL')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        WellnessProviderSchemaInitializer migration = new WellnessProviderSchemaInitializer();
        migration.allowManualProvider(jdbc);
        migration.allowManualProvider(jdbc);
        jdbc.update("INSERT INTO daily_sleep_data VALUES (2, 'MANUAL')");
        assertThat(jdbc.queryForObject("SELECT provider FROM daily_sleep_data WHERE id=1", String.class)).isEqualTo("GARMIN");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO daily_sleep_data VALUES (3, NULL)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO daily_sleep_data VALUES (3, 'UNKNOWN')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void upgradesExistingPostgresChecks() throws Exception {
        String url = System.getenv("HERMES_TEST_POSTGRES_URL");
        assumeTrue(url != null && !url.isBlank(), "PostgreSQL fixture is supplied in CI and explicit local upgrade tests");
        String schema = "wellness_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        DriverManagerDataSource source = new DriverManagerDataSource(url,
                System.getenv("HERMES_TEST_POSTGRES_USER"), System.getenv("HERMES_TEST_POSTGRES_PASSWORD"));
        try (Connection connection = source.getConnection()) {
            JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            jdbc.execute("CREATE SCHEMA " + schema);
            try {
                connection.setSchema(schema);
                verifyLegacyChecks(jdbc);
            } finally {
                // Only this test's UUID-named schema is removed; never the database.
                jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    private void verifyLegacyChecks(JdbcTemplate jdbc) {
        verifyLegacyChecks(jdbc, false);
    }

    private void verifyLegacyChecks(JdbcTemplate jdbc, boolean interruptedUpgrade) {
        for (String table : TABLES) {
            jdbc.execute("CREATE TABLE " + table + " (id INT PRIMARY KEY, provider VARCHAR(32) NOT NULL,"
                    + " amount INT CHECK (amount >= 0), CONSTRAINT " + table + "_provider_check"
                    + " CHECK (provider IN ('GARMIN','STRAVA')), CHECK (provider <> 'FORBIDDEN'))");
            jdbc.update("INSERT INTO " + table + " VALUES (1, 'GARMIN', 1)");
            assertThatThrownBy(() -> jdbc.update("INSERT INTO " + table + " VALUES (2, 'MANUAL', 1)"))
                    .isInstanceOf(DataIntegrityViolationException.class);
            if (interruptedUpgrade) {
                jdbc.execute("ALTER TABLE " + table + " ADD CONSTRAINT \"" + table.toUpperCase(java.util.Locale.ROOT)
                        + "_PROVIDER_CHECK_manual\" CHECK (provider IN ('GARMIN','STRAVA') OR provider = 'MANUAL')");
            }
        }
        WellnessProviderSchemaInitializer migration = new WellnessProviderSchemaInitializer();
        migration.allowManualProvider(jdbc);
        migration.allowManualProvider(jdbc);
        for (String table : TABLES) {
            jdbc.update("INSERT INTO " + table + " VALUES (2, 'MANUAL', 1)");
            assertThat(jdbc.queryForObject("SELECT provider FROM " + table + " WHERE id=1", String.class)).isEqualTo("GARMIN");
            for (String invalid : List.of("(3, 'UNKNOWN', 1)", "(3, NULL, 1)", "(3, 'MANUAL', -1)")) {
                assertThatThrownBy(() -> jdbc.update("INSERT INTO " + table + " VALUES " + invalid))
                        .isInstanceOf(DataIntegrityViolationException.class);
            }
        }
    }
}
