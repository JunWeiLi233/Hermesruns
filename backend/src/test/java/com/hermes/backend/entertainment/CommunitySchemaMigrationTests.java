package com.hermes.backend.entertainment;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.story.StoryChapterProgress;
import com.hermes.backend.story.StoryPreferences;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class CommunitySchemaMigrationTests {
    @Test
    void additiveMigrationCanBeReappliedAndPassesHibernateValidation() throws Exception {
        verifyMigration("jdbc:h2:mem:community-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
    }

    @Test
    void postgresReleaseSqlPassesEntityValidationWithoutChangingVerifiedRoutes() throws Exception {
        String url = System.getenv("HERMES_TEST_POSTGRES_URL");
        assumeTrue(url != null && !url.isBlank(), "Explicit disposable PostgreSQL fixture required");
        String user = System.getenv("HERMES_TEST_POSTGRES_USER");
        String password = System.getenv("HERMES_TEST_POSTGRES_PASSWORD");
        String schema = "community_release_" + UUID.randomUUID().toString().replace("-", "");
        var jdbc = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        jdbc.execute("CREATE SCHEMA " + schema);
        try {
            verifyMigration(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, user, password);
        } finally {
            jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    private void verifyMigration(String url, String user, String password) throws Exception {
        // Create only the existing owner table; the new ten tables must come from SQL.
        try (var owners = configuration(url, user, password, "create", List.of(Runner.class)).buildSessionFactory()) {
            assertThat(owners.isOpen()).isTrue();
            try (var session = owners.openSession()) {
                var transaction = session.beginTransaction();
                session.persist(new Runner("community-migration@hermes.test", "ACTIVE"));
                transaction.commit();
            }
        }
        var source = new DriverManagerDataSource(url, user, password);
        var jdbc = new JdbcTemplate(source);
        jdbc.execute("create table race_course_map_asset(race_id varchar(128) primary key, live_route_points_json text)");
        jdbc.update("insert into race_course_map_asset values(?, ?)", "tokyo-marathon", "verified route bytes");
        if (url.startsWith("jdbc:postgresql:")) verifyPostgresCompatibilityMigration(jdbc);
        var migration = new ResourceDatabasePopulator(
                new ClassPathResource("db/community/V001__entertainment_and_story.sql"));
        migration.execute(source);
        jdbc.update("insert into story_preferences(runner_id, mode, current_panel) "
                + "select id, 'invitation', 'shelf' from runner");
        migration.execute(source);
        assertThat(jdbc.queryForObject("select count(*) from story_preferences", Integer.class)).isEqualTo(1);
        try (var candidate = configuration(url, user, password, "validate", List.of(Runner.class,
                EntertainmentGroup.class, EntertainmentMember.class, EntertainmentSlot.class,
                EntertainmentMission.class, EntertainmentPreferences.class, EntertainmentMemory.class,
                EntertainmentReceipt.class, EntertainmentInvite.class,
                StoryPreferences.class, StoryChapterProgress.class)).buildSessionFactory()) {
            assertThat(candidate.isOpen()).isTrue();
        }
        assertThat(jdbc.queryForObject("select live_route_points_json from race_course_map_asset where race_id=?",
                String.class, "tokyo-marathon")).isEqualTo("verified route bytes");
    }

    private void verifyPostgresCompatibilityMigration(JdbcTemplate jdbc) throws Exception {
        var tables = List.of("daily_sleep_data", "daily_hrv_data", "daily_wellness_summary", "daily_stress_data");
        for (String table : tables) {
            jdbc.execute("create table " + table + " (id integer primary key, provider varchar(32) not null"
                    + " check(provider in ('GARMIN','STRAVA')), amount integer check(amount >= 0))");
            jdbc.update("insert into " + table + " values(1,'GARMIN',1)");
        }
        String sql;
        try (var input = new ClassPathResource("db/compatibility/V001__runtime_schema.sql").getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        jdbc.execute(sql);
        jdbc.execute(sql);
        for (String table : tables) {
            jdbc.update("insert into " + table + " values(2,'MANUAL',1)");
            assertThat(jdbc.queryForObject("select provider from " + table + " where id=1", String.class))
                    .isEqualTo("GARMIN");
            for (String invalid : List.of("(3,'UNKNOWN',1)", "(3,NULL,1)", "(3,'MANUAL',-1)")) {
                assertThatThrownBy(() -> jdbc.update("insert into " + table + " values" + invalid))
                        .isInstanceOf(DataIntegrityViolationException.class);
            }
        }
        assertThat(jdbc.queryForList("select local_route_artifact_ref, local_route_updated_at,"
                + " local_route_updated_by_email from race_course_map_asset")).hasSize(1);
    }

    private Configuration configuration(String url, String user, String password, String schemaAction, List<Class<?>> entities) {
        var configuration = new Configuration()
                .setProperty("hibernate.connection.url", url)
                .setProperty("hibernate.connection.username", user)
                .setProperty("hibernate.connection.password", password)
                .setProperty("hibernate.hbm2ddl.auto", schemaAction)
                .setProperty("hibernate.physical_naming_strategy",
                        "org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl");
        entities.forEach(configuration::addAnnotatedClass);
        return configuration;
    }
}
