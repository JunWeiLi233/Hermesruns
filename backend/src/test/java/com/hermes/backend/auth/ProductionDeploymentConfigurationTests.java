package com.hermes.backend.auth;

import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionDeploymentConfigurationTests {
    private static final AtomicBoolean SCHEMA_WRITER_RAN = new AtomicBoolean();
    @Test
    void productionProfileActivatesGuardsAndPreservesDatabaseAndRoutes() {
        var environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "spring.profiles.active", "production,sleep",
                "spring.config.location", "classpath:/")));
        ConfigDataEnvironmentPostProcessor.applyTo(environment);

        assertThat(environment.getProperty("hermes.environment")).isEqualTo("production");
        assertThat(environment.getProperty("app.security.force-https")).isEqualTo("true");
        assertThat(environment.getProperty("app.security.enable-hsts")).isEqualTo("true");
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("app.official-course.startup-seed.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("app.course-map.bulk-seed.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("app.course-map.bulk-scan.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("app.training-workspace.cookie-secure")).isEqualTo("true");
        assertThat(environment.getProperty("app.training-workspace.migrate")).isEqualTo("false");
        assertThat(environment.getProperty("app.schema-compatibility.enabled")).isEqualTo("false");
        assertThat(environment.getProperty("server.address")).isEqualTo("0.0.0.0");
        assertThat(environment.getProperty("app.course-map.upload-dir")).isEqualTo("/data/course-map-images");
    }

    @Test
    void disabledCompatibilityWritersDoNotRequireOrUseADatasource() {
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
                .withUserConfiguration(com.hermes.backend.races.RaceCourseMapSchemaInitializer.class,
                        com.hermes.backend.coaching.WellnessProviderSchemaInitializer.class)
                .withPropertyValues("app.schema-compatibility.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean("raceCourseMapSchemaCompatibilityRunner");
                    assertThat(context).doesNotHaveBean("wellnessProviderSchemaCompatibility");
                });
    }

    @Test
    void developmentValidatorAcceptsExistingH2MigrationModeDuringPropertyInjection() {
        new org.springframework.boot.test.context.runner.ApplicationContextRunner()
                .withUserConfiguration(ProductionSecurityValidator.class)
                .withPropertyValues("hermes.environment=development", "app.training-workspace.migrate=h2")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(ProductionSecurityValidator.class);
                });
    }

    @Test
    void productionRejectsUnsafeOverridesBeforeAnySchemaWriterIsConstructed() {
        for (String[] override : new String[][] {
                {"spring.jpa.hibernate.ddl-auto=update", "APP_JPA_DDL_AUTO"},
                {"app.training-workspace.migrate=true", "app.training-workspace.migrate and app.schema-compatibility.enabled"},
                {"app.schema-compatibility.enabled=true", "app.training-workspace.migrate and app.schema-compatibility.enabled"},
                {"app.course-map.bulk-seed.enabled=true", "app.course-map.bulk-seed.enabled and app.course-map.bulk-scan.enabled"},
                {"app.course-map.bulk-scan.enabled=true", "app.course-map.bulk-seed.enabled and app.course-map.bulk-scan.enabled"}}) {
            SCHEMA_WRITER_RAN.set(false);
            new org.springframework.boot.test.context.runner.ApplicationContextRunner()
                    .withUserConfiguration(ProductionStartupGuardConfiguration.class,
                            SyntheticSchemaWriters.class, ProductionSecurityValidator.class)
                    .withPropertyValues("hermes.environment=production",
                            "spring.datasource.url=jdbc:postgresql://fixture.invalid/hermes",
                            "app.official-course.startup-seed.enabled=false",
                            "spring.jpa.hibernate.ddl-auto=validate", "app.training-workspace.migrate=false",
                            "app.schema-compatibility.enabled=false", override[0])
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertThat(context.getStartupFailure()).hasStackTraceContaining(override[1]);
                        assertThat(SCHEMA_WRITER_RAN).isFalse();
                    });
        }
    }

    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods = false)
    static class SyntheticSchemaWriters {
        @org.springframework.context.annotation.Bean("entityManagerFactory")
        Object entityManagerFactory() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("trainingStore")
        Object trainingStore() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("wellnessProviderSchemaCompatibility")
        Object wellnessProviderSchemaCompatibility() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("raceCourseMapSchemaCompatibilityRunner")
        Object raceCourseMapSchemaCompatibilityRunner() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("dataSourceScriptDatabaseInitializer")
        Object dataSourceScriptDatabaseInitializer() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("officialCourseStartupSeeder")
        Object officialCourseStartupSeeder() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("raceCourseMapBulkSeedCommand")
        Object raceCourseMapBulkSeedCommand() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
        @org.springframework.context.annotation.Bean("courseMapBulkScanCommand")
        Object courseMapBulkScanCommand() { SCHEMA_WRITER_RAN.set(true); return new Object(); }
    }
}
