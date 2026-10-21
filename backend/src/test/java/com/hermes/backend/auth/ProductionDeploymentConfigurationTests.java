package com.hermes.backend.auth;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionDeploymentConfigurationTests {
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
        assertThat(environment.getProperty("app.training-workspace.cookie-secure")).isEqualTo("true");
        assertThat(environment.getProperty("app.training-workspace.migrate")).isEqualTo("false");
        assertThat(environment.getProperty("server.address")).isEqualTo("0.0.0.0");
        assertThat(environment.getProperty("app.course-map.upload-dir")).isEqualTo("/data/course-map-images");
    }
}
