package com.hermes.backend;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;

class SleepProfileTests {
    @Test
    @org.junit.jupiter.api.Timeout(100)
    void realPoolRetiresIdleConnectionsAndReconnectsOnDemand() throws Exception {
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new ResourcePropertySource(
                new ClassPathResource("application-sleep.properties")));
        try (HikariDataSource dataSource = new HikariDataSource()) {
            Binder.get(environment).bind("spring.datasource.hikari", Bindable.ofInstance(dataSource));
            dataSource.setJdbcUrl("jdbc:h2:mem:sleep-idle-test;DB_CLOSE_DELAY=-1");
            dataSource.setUsername("sa");
            dataSource.setMaximumPoolSize(2);
            try (var connection = dataSource.getConnection()) {
                assertThat(connection.isValid(1)).isTrue();
            }
            long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(95);
            while (dataSource.getHikariPoolMXBean().getTotalConnections() != 0
                    && System.nanoTime() < deadline) {
                Thread.sleep(250);
            }
            assertThat(dataSource.getHikariPoolMXBean().getTotalConnections()).isZero();
            try (var connection = dataSource.getConnection(); var query = connection.createStatement();
                 var result = query.executeQuery("SELECT 1")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getInt(1)).isEqualTo(1);
            }
        }
    }

    @Test
    void sleepProfileReleasesIdleConnectionsWithoutDisablingIntegrations() throws Exception {
        ClassPathResource resource = new ClassPathResource("application-sleep.properties");
        assertThat(resource.exists()).as("opt-in sleep profile must exist").isTrue();
        StandardEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(new ResourcePropertySource(resource));
        try (HikariDataSource dataSource = new HikariDataSource()) {
            Binder.get(environment).bind("spring.datasource.hikari", Bindable.ofInstance(dataSource));
            assertThat(dataSource.getMinimumIdle()).isZero();
            assertThat(dataSource.getIdleTimeout()).isEqualTo(60_000L);
            assertThat(dataSource.getKeepaliveTime()).isZero();
            assertThat(environment.getProperty("app.background.polling.enabled")).isEqualTo("false");
            assertThat(environment.getProperty("app.coach.nightly.cron")).isEqualTo("-");
            assertThat(environment.getProperty("strava.sync.enabled")).isNull();
            assertThat(environment.getProperty("garmin.wellness.sync.enabled")).isNull();
        }
    }
}
