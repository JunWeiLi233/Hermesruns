package com.hermes.backend;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Fails fast in production when known-weak defaults would be exposed on the public internet.
 */
@Component
public class ProductionSecurityValidator {

    private static final String DEFAULT_STRAVA_VERIFY = "hermes-strava-webhook";

    @Value("${hermes.environment:development}")
    private String environment;

    @Value("${strava.client.id:}")
    private String stravaClientId;

    @Value("${strava.webhook.verify-token:}")
    private String stravaWebhookVerifyToken;

    @PostConstruct
    void validate() {
        if (!isProduction()) {
            return;
        }
        if (stravaClientId == null || stravaClientId.isBlank()) {
            return;
        }
        if (stravaWebhookVerifyToken == null || stravaWebhookVerifyToken.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production and Strava is enabled: set STRAVA_WEBHOOK_VERIFY_TOKEN to a long random secret.");
        }
        if (DEFAULT_STRAVA_VERIFY.equals(stravaWebhookVerifyToken.trim())) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: STRAVA_WEBHOOK_VERIFY_TOKEN must not use the default 'hermes-strava-webhook'.");
        }
    }

    private boolean isProduction() {
        return environment != null && "production".equalsIgnoreCase(environment.trim());
    }
}
