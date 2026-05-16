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

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.security.enable-hsts:false}")
    private boolean hstsEnabled;

    @Value("${app.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Value("${app.billing.public-base-url:}")
    private String publicBaseUrl;

    @Value("${recaptcha.secret-key:}")
    private String recaptchaSecretKey;

    @Value("${recaptcha.site-key:}")
    private String recaptchaSiteKey;

    @PostConstruct
    void validate() {
        if (!isProduction()) {
            return;
        }
        validateDatasource();
        validateHsts();
        validateCorsOrigins();
        validatePublicBaseUrl();
        validateStravaWebhookToken();
        validateRecaptchaKeys();
    }

    private void validateRecaptchaKeys() {
        if (recaptchaSecretKey == null || recaptchaSecretKey.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: set RECAPTCHA_SECRET_KEY so signup bot protection is active.");
        }
        if (recaptchaSiteKey == null || recaptchaSiteKey.isBlank()) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: set RECAPTCHA_SITE_KEY so signup can generate verification tokens.");
        }
    }

    private void validateStravaWebhookToken() {
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

    private void validateDatasource() {
        String normalized = normalize(datasourceUrl);
        if (normalized.startsWith("jdbc:h2:")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: local H2 is not allowed. Configure APP_DB_URL/APP_DB_DRIVER for managed PostgreSQL.");
        }
    }

    private void validateHsts() {
        if (!hstsEnabled) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: enable HSTS by setting APP_ENABLE_HSTS=true behind HTTPS.");
        }
    }

    private void validateCorsOrigins() {
        String normalized = normalize(corsAllowedOrigins);
        if (normalized.isBlank()) {
            return;
        }
        String[] origins = normalized.split(",");
        for (String rawOrigin : origins) {
            String origin = normalize(rawOrigin);
            if (origin.contains("localhost") || origin.contains("127.0.0.1")) {
                throw new IllegalStateException(
                        "HERMES_ENV=production: APP_CORS_ALLOWED_ORIGINS must not include localhost origins.");
            }
            if (origin.startsWith("http://")) {
                throw new IllegalStateException(
                        "HERMES_ENV=production: APP_CORS_ALLOWED_ORIGINS must use HTTPS origins only.");
            }
        }
    }

    private void validatePublicBaseUrl() {
        String normalized = normalize(publicBaseUrl);
        if (normalized.isBlank()) {
            return;
        }
        if (normalized.contains("localhost") || normalized.contains("127.0.0.1")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_PUBLIC_BASE_URL must not point to localhost.");
        }
        if (!normalized.startsWith("https://")) {
            throw new IllegalStateException(
                    "HERMES_ENV=production: APP_PUBLIC_BASE_URL must use HTTPS.");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private boolean isProduction() {
        return environment != null && "production".equalsIgnoreCase(environment.trim());
    }
}
