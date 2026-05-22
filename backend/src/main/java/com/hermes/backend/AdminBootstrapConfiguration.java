package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdminBootstrapConfiguration {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapConfiguration.class);

    @Value("${APP_BOOTSTRAP_ADMIN_EMAIL:}")
    private String bootstrapAdminEmail;

    @Value("${APP_BOOTSTRAP_ADMIN_PASSWORD:}")
    private String bootstrapAdminPassword;

    @Bean
    @ConditionalOnMissingBean(name = "bootstrapAdminRunner")
    ApplicationRunner bootstrapAdminRunner(RunnerRepository runnerRepository, AuthService authService) {
        return args -> {
            String normalizedEmail = authService.normalizeEmail(bootstrapAdminEmail);
            if (normalizedEmail == null || normalizedEmail.isBlank()) {
                return;
            }

            if (bootstrapAdminPassword == null || bootstrapAdminPassword.isBlank()) {
                log.warn("[Hermes] APP_BOOTSTRAP_ADMIN_EMAIL is set, but APP_BOOTSTRAP_ADMIN_PASSWORD is missing.");
                return;
            }

            Runner admin = runnerRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(Runner::new);
            admin.setEmail(normalizedEmail);
            admin.setDeleted(false);
            admin.setStatus("ACTIVE");
            admin.setRole("ADMIN");
            admin.setEmailVerified(true);
            authService.storePassword(admin, bootstrapAdminPassword);
            runnerRepository.save(admin);

            log.info("[Hermes] Bootstrap admin account is ready for {}", normalizedEmail);
        };
    }
}
