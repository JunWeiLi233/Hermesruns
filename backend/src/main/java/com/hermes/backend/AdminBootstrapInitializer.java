package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdminBootstrapInitializer {
    @Value("${APP_BOOTSTRAP_ADMIN_EMAIL:}")
    private String bootstrapAdminEmail;

    @Value("${APP_BOOTSTRAP_ADMIN_PASSWORD:}")
    private String bootstrapAdminPassword;

    @Bean
    ApplicationRunner bootstrapAdminRunner(RunnerRepository runnerRepository, AuthService authService) {
        return args -> {
            String normalizedEmail = authService.normalizeEmail(bootstrapAdminEmail);
            if (normalizedEmail == null || normalizedEmail.isBlank()) {
                return;
            }

            if (bootstrapAdminPassword == null || bootstrapAdminPassword.isBlank()) {
                System.out.println("[Hermes] APP_BOOTSTRAP_ADMIN_EMAIL is set, but APP_BOOTSTRAP_ADMIN_PASSWORD is missing.");
                return;
            }

            Runner admin = runnerRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(Runner::new);
            admin.setEmail(normalizedEmail);
            admin.setDeleted(false);
            admin.setStatus("ACTIVE");
            admin.setRole("ADMIN");
            authService.storePassword(admin, bootstrapAdminPassword);
            runnerRepository.save(admin);

            System.out.println("[Hermes] Bootstrap admin account is ready for " + normalizedEmail);
        };
    }
}
