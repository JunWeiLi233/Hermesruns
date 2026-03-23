package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseDiagnosticsInitializer {
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
                System.out.println("[Hermes] No datasource URL is configured.");
                return;
            }

            String mode = datasourceUrl.startsWith("jdbc:postgresql:") ? "PostgreSQL"
                    : datasourceUrl.startsWith("jdbc:h2:") ? "H2"
                    : "Custom JDBC";

            System.out.println("[Hermes] Database mode: " + mode);
            System.out.println("[Hermes] JDBC driver: " + datasourceDriver);
            System.out.println("[Hermes] Hibernate ddl-auto: " + ddlAuto);

            if ("PostgreSQL".equals(mode) && !"update".equalsIgnoreCase(ddlAuto) && !"validate".equalsIgnoreCase(ddlAuto)) {
                System.out.println("[Hermes] Warning: nonstandard ddl-auto mode detected for PostgreSQL: " + ddlAuto);
            }
        };
    }
}
