package com.hermes.backend.admin;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
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

    @Value("${hermes.environment:development}")
    private String environment;

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

            if (!"development".equalsIgnoreCase(environment == null ? "" : environment.trim())) {
                log.warn("[Hermes] Admin bootstrap is available only in development. Remove bootstrap credentials.");
                return;
            }
            // Bootstrap creates the first administrator. It must never become a
            // password reset, account reactivation, or runner promotion on restart.
            if (runnerRepository.existsByEmailIgnoreCase(normalizedEmail)) {
                log.info("[Hermes] Admin bootstrap skipped: account already exists. Remove bootstrap credentials.");
                return;
            }
            if (runnerRepository.count((root, query, criteria) ->
                    criteria.equal(criteria.upper(root.get("role")), "ADMIN")) > 0) {
                log.info("[Hermes] Admin bootstrap skipped: administrator already exists. Remove bootstrap credentials.");
                return;
            }

            Runner admin = new Runner();
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
