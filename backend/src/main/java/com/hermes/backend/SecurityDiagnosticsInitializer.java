package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityDiagnosticsInitializer {
    @Value("${google.client.id:}")
    private String googleClientId;

    @Value("${google.client.secret:}")
    private String googleClientSecret;

    @Value("${strava.client.id:}")
    private String stravaClientId;

    @Value("${strava.client.secret:}")
    private String stravaClientSecret;

    @Value("${APP_BOOTSTRAP_ADMIN_EMAIL:}")
    private String bootstrapAdminEmail;

    @Value("${APP_BOOTSTRAP_ADMIN_PASSWORD:}")
    private String bootstrapAdminPassword;

    @Bean
    ApplicationRunner securityDiagnosticsRunner(SecretEncryptionService secretEncryptionService) {
        return args -> {
            logIfHalfConfigured("Google OAuth", googleClientId, googleClientSecret);
            logIfHalfConfigured("Strava OAuth", stravaClientId, stravaClientSecret);

            boolean stravaConfigured = isPresent(stravaClientId) && isPresent(stravaClientSecret);
            if (stravaConfigured && !secretEncryptionService.isConfigured()) {
                System.out.println("[Hermes] Strava OAuth credentials are set, but APP_DATA_ENCRYPTION_KEY is missing.");
                System.out.println("[Hermes] Strava sign-in will remain unavailable until APP_DATA_ENCRYPTION_KEY is configured.");
            }

            logIfHalfConfigured("Admin bootstrap", bootstrapAdminEmail, bootstrapAdminPassword);
        };
    }

    private void logIfHalfConfigured(String label, String leftValue, String rightValue) {
        boolean leftPresent = isPresent(leftValue);
        boolean rightPresent = isPresent(rightValue);
        if (leftPresent != rightPresent) {
            System.out.println("[Hermes] " + label + " is only partially configured.");
        }
    }

    private boolean isPresent(String value) {
        return value != null && !value.trim().isBlank();
    }
}
