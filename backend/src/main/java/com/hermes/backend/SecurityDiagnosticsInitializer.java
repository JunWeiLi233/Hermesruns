package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityDiagnosticsInitializer {
    private static final Logger logger = LoggerFactory.getLogger(SecurityDiagnosticsInitializer.class);
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
                logger.warn("[Hermes] Strava OAuth credentials are set, but APP_DATA_ENCRYPTION_KEY is missing.");
                logger.warn("[Hermes] Strava sign-in will remain unavailable until APP_DATA_ENCRYPTION_KEY is configured.");
            }

            logIfHalfConfigured("Admin bootstrap", bootstrapAdminEmail, bootstrapAdminPassword);
        };
    }

    private void logIfHalfConfigured(String label, String leftValue, String rightValue) {
        boolean leftPresent = isPresent(leftValue);
        boolean rightPresent = isPresent(rightValue);
        if (leftPresent != rightPresent) {
            logger.warn("[Hermes] {} is only partially configured.", label);
        }
    }

    private boolean isPresent(String value) {
        return value != null && !value.trim().isBlank();
    }
}
