package com.hermes.backend;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Enumeration;
import java.util.Properties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the runtime-footprint defaults in the packaged property files without
 * booting a Spring context: bounded Hikari pool, Tomcat threads, scheduler pool,
 * Hibernate JDBC batching, graceful shutdown, and the production-only PostgreSQL
 * batch-rewrite flag (which H2 must never see).
 */
class RuntimeFootprintConfigContractTests {

    @Test
    void boundsDefaultConnectionPool() {
        Properties properties = loadMain("application.properties");
        assertThat(properties.getProperty("spring.datasource.hikari.maximumPoolSize"))
                .isEqualTo("${APP_DB_POOL_MAX:6}");
        assertThat(properties.getProperty("spring.datasource.hikari.minimumIdle"))
                .isEqualTo("${APP_DB_POOL_MIN_IDLE:2}");
        assertThat(properties.getProperty("spring.datasource.hikari.maxLifetime")).isEqualTo("900000");
        assertThat(properties.getProperty("spring.datasource.hikari.keepaliveTime")).isEqualTo("300000");
    }

    @Test
    void boundsTomcatThreadsAndShutsDownGracefully() {
        Properties properties = loadMain("application.properties");
        assertThat(properties.getProperty("server.tomcat.threads.max")).isEqualTo("${APP_TOMCAT_MAX_THREADS:24}");
        assertThat(properties.getProperty("server.tomcat.threads.min-spare")).isEqualTo("4");
        assertThat(properties.getProperty("server.shutdown")).isEqualTo("graceful");
        assertThat(properties.getProperty("spring.lifecycle.timeout-per-shutdown-phase")).isEqualTo("10s");
    }

    @Test
    void widensSchedulerPoolBeyondSingleThread() {
        Properties properties = loadMain("application.properties");
        assertThat(properties.getProperty("spring.task.scheduling.pool.size")).isEqualTo("2");
    }

    @Test
    void enablesHibernateJdbcBatching() {
        Properties properties = loadMain("application.properties");
        assertThat(properties.getProperty("spring.jpa.properties.hibernate.jdbc.batch_size")).isEqualTo("50");
        assertThat(properties.getProperty("spring.jpa.properties.hibernate.order_inserts")).isEqualTo("true");
        assertThat(properties.getProperty("spring.jpa.properties.hibernate.order_updates")).isEqualTo("true");
        assertThat(properties.getProperty("spring.jpa.properties.hibernate.default_batch_fetch_size"))
                .isEqualTo("16");
    }

    @Test
    void skipsRedisRepositoryScanning() {
        Properties properties = loadMain("application.properties");
        assertThat(properties.getProperty("spring.data.redis.repositories.enabled")).isEqualTo("false");
    }

    @Test
    void reWriteBatchedInsertsIsProductionOnly() {
        Properties production = loadMain("application-production.properties");
        assertThat(production.getProperty("spring.datasource.hikari.data-source-properties.reWriteBatchedInserts"))
                .isEqualTo("true");

        Properties defaults = loadMain("application.properties");
        assertThat(defaults.stringPropertyNames())
                .noneMatch(key -> key.startsWith("spring.datasource.hikari.data-source-properties."));
    }

    /**
     * Loads the packaged main-classes copy of a properties file. The test classpath
     * also carries src/test/resources/application.properties (a seed-disable
     * override), so the first non-test-classes match wins.
     */
    private static Properties loadMain(String location) {
        try {
            URL selected = null;
            Enumeration<URL> urls = RuntimeFootprintConfigContractTests.class.getClassLoader().getResources(location);
            while (urls.hasMoreElements()) {
                URL url = urls.nextElement();
                if (!url.getPath().contains("test-classes")) {
                    selected = url;
                    break;
                }
                if (selected == null) {
                    selected = url;
                }
            }
            assertThat(selected).as("classpath resource " + location).isNotNull();
            Properties properties = new Properties();
            try (InputStream in = selected.openStream()) {
                properties.load(in);
            }
            return properties;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load " + location + " from classpath", e);
        }
    }
}
