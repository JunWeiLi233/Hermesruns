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
        var tables = List.of("daily_sleep_data", "daily_hrv_data", "daily_wellness_summary", "daily_stress_data",
                "body_composition_data");
        for (String table : tables) {
            jdbc.execute("create table " + table + " (id integer primary key, provider varchar(32) not null"
                    + " check(provider in ('GARMIN','STRAVA')), amount integer check(amount >= 0))");
            jdbc.update("insert into " + table + " values(1,'GARMIN',1)");
        }
        for (int pass = 0; pass < 2; pass++) {
            for (String resource : List.of("V001__runtime_schema.sql", "V002__wellness_provider_domain.sql")) {
                try (var input = new ClassPathResource("db/compatibility/" + resource).getInputStream()) {
                    jdbc.execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
                }
            }
        }
        for (String table : tables) {
            jdbc.update("insert into " + table + " values(2,'MANUAL',1)");
            int id = 10;
            for (var provider : com.hermes.backend.activity.ImportProvider.values()) {
                jdbc.update("insert into " + table + " values(?,?,1)", id++, provider.name());
            }
            assertThat(jdbc.queryForObject("select provider from " + table + " where id=1", String.class))
                    .isEqualTo("GARMIN");
            for (String invalid : List.of("(3,'UNKNOWN',1)", "(3,NULL,1)", "(3,'MANUAL',-1)")) {
                assertThatThrownBy(() -> jdbc.update("insert into " + table + " values" + invalid))
                        .isInstanceOf(DataIntegrityViolationException.class);
            }
        }
        assertThat(jdbc.queryForList("select local_route_artifact_ref, local_route_updated_at,"
                + " local_route_updated_by_email from race_course_map_asset")).hasSize(1);
        // Invalid legacy data must abort the entire five-table upgrade, leaving
        // the evidence and every original check intact for an operator to review.
        jdbc.execute("alter table daily_stress_data drop constraint daily_stress_data_provider_check,"
                + " add constraint daily_stress_data_provider_check check(provider <> 'FORBIDDEN')");
        jdbc.update("insert into daily_stress_data values(99,'UNKNOWN',1)");
        String checks = "select t.relname, c.conname, pg_get_constraintdef(c.oid) as predicate from pg_constraint c"
                + " join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace"
                + " where n.nspname=current_schema() and c.contype='c' order by t.relname,c.conname";
        var before = jdbc.queryForList(checks);
        String sql;
        try (var input = new ClassPathResource("db/compatibility/V002__wellness_provider_domain.sql").getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        String migration = sql;
        jdbc.execute("alter table daily_sleep_data add constraint unexpected_provider_rule check(provider <> 'FORBIDDEN')");
        var extraCheckBefore = jdbc.queryForList(checks);
        assertThatThrownBy(() -> jdbc.execute(migration)).hasMessageContaining("Missing or unexpected provider constraint");
        assertThat(jdbc.queryForList(checks)).isEqualTo(extraCheckBefore);
        jdbc.execute("alter table daily_sleep_data drop constraint unexpected_provider_rule");
        assertThatThrownBy(() -> jdbc.execute(migration)).hasMessageContaining("Unexpected provider values");
        assertThat(jdbc.queryForList(checks)).isEqualTo(before);
        assertThat(jdbc.queryForObject("select provider from daily_stress_data where id=99", String.class))
                .isEqualTo("UNKNOWN");
        jdbc.update("delete from daily_stress_data where id=99");
        jdbc.execute(migration);
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
