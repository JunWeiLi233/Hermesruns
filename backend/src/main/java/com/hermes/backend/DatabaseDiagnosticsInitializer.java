package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseDiagnosticsInitializer {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseDiagnosticsInitializer.class);
    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.datasource.driverClassName:}")
    private String datasourceDriver;

    @Value("${spring.jpa.hibernate.ddl-auto:update}")
    private String ddlAuto;

    @Bean
    ApplicationRunner databaseDiagnosticsRunner() {
        return args -> {
            if (datasourceUrl == null || datasourceUrl.isBlank()) {
                logger.info("[Hermes] No datasource URL is configured.");
                return;
            }

            String mode = datasourceUrl.startsWith("jdbc:postgresql:") ? "PostgreSQL"
                    : datasourceUrl.startsWith("jdbc:h2:") ? "H2"
                    : "Custom JDBC";

            logger.info("[Hermes] Database mode: {}", mode);
            logger.info("[Hermes] JDBC driver: {}", datasourceDriver);
            logger.info("[Hermes] Hibernate ddl-auto: {}", ddlAuto);

            if ("PostgreSQL".equals(mode) && !"update".equalsIgnoreCase(ddlAuto) && !"validate".equalsIgnoreCase(ddlAuto)) {
                logger.warn("[Hermes] Warning: nonstandard ddl-auto mode detected for PostgreSQL: {}", ddlAuto);
            }
        };
    }
}
