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

    @Value("${hermes.environment:development}")
    private String environment;

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

    @Value("${app.mail.provider:disabled}")
    private String mailProvider;

    @Value("${app.mail.resend.api-key:}")
    private String resendApiKey;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${app.mail.reply-to:}")
    private String mailReplyTo;

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
            logTransactionalMailState();
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

    private void logTransactionalMailState() {
        if ("production".equalsIgnoreCase(environment == null ? "" : environment.trim())) {
            return;
        }
        if (!isPresent(mailProvider) || "disabled".equalsIgnoreCase(mailProvider.trim())) {
            logger.info("[Hermes] Transactional mail provider disabled.");
        } else if ("resend".equalsIgnoreCase(mailProvider.trim())
                && isPresent(resendApiKey) && isPresent(mailFrom) && isPresent(mailReplyTo)) {
            logger.info("[Hermes] Transactional mail provider configured.");
        } else {
            logger.warn("[Hermes] Transactional mail provider partially configured.");
        }
    }
}
