package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Centralized "are integrations configured?" checks.
 * <p>
 * This reduces duplicated config-check logic spread across controllers.
 * </p>
 */
@Component
public class SystemConfigService {

    private final SecretEncryptionService secretEncryptionService;

    // Google OAuth
    @Value("${google.client.id:}")
    private String googleClientId;
    @Value("${google.client.secret:}")
    private String googleClientSecret;
    @Value("${app.google.redirect-uri:http://localhost:8080/api/auth/google/callback}")
    private String googleRedirectUri;

    // Strava OAuth
    @Value("${strava.client.id:}")
    private String stravaClientId;
    @Value("${strava.client.secret:}")
    private String stravaClientSecret;
    @Value("${app.strava.redirect-uri:http://localhost:8080/api/auth/strava/callback}")
    private String stravaRedirectUri;

    // AI / Shoe scanning
    @Value("${app.ai.api-key:}")
    private String aiApiKey;
    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;
    @Value("${app.ai.provider:gemini}")
    private String aiProvider;

    // Billing / Stripe
    @Value("${app.billing.stripe.secret-key:}")
    private String stripeSecretKey;
    @Value("${app.billing.stripe.webhook-secret:}")
    private String stripeWebhookSecret;
    @Value("${app.billing.stripe.price-pro-monthly:}")
    private String stripePriceProMonthly;
    @Value("${app.billing.public-base-url:http://localhost:8080}")
    private String publicBaseUrl;
    @Value("${app.billing.price-display-label:}")
    private String priceDisplayLabel;

    public SystemConfigService(SecretEncryptionService secretEncryptionService) {
        this.secretEncryptionService = secretEncryptionService;
    }

    private static boolean isPresent(String v) {
        return v != null && !v.trim().isBlank();
    }

    public boolean isGoogleConfigured() {
        return isPresent(googleClientId) && isPresent(googleClientSecret);
    }

    public boolean isStravaConfigured() {
        return isPresent(stravaClientId) && isPresent(stravaClientSecret) && secretEncryptionService.isConfigured();
    }

    public Map<String, Object> getStravaStatus() {
        boolean clientIdPresent = isPresent(stravaClientId);
        boolean clientSecretPresent = isPresent(stravaClientSecret);
        boolean encryptionKeyConfigured = secretEncryptionService.isConfigured();
        boolean configured = isStravaConfigured();

        String reason = null;
        if (!clientIdPresent) {
            reason = "STRAVA_CLIENT_ID is missing/blank.";
        } else if (!clientSecretPresent) {
            reason = "STRAVA_CLIENT_SECRET is missing/blank.";
        } else if (!encryptionKeyConfigured) {
            reason = "APP_DATA_ENCRYPTION_KEY is missing/blank (required to store Strava tokens).";
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("configured", configured);
        response.put("clientIdPresent", clientIdPresent);
        response.put("clientSecretPresent", clientSecretPresent);
        response.put("encryptionKeyConfigured", encryptionKeyConfigured);
        response.put("redirectUri", stravaRedirectUri);
        response.put("reason", reason);
        return response;
    }

    public boolean isAiConfigured() {
        return isPresent(aiApiKey);
    }

    public boolean isCheckoutFullyConfigured() {
        return isPresent(stripeSecretKey) && isPresent(stripePriceProMonthly);
    }

    /**
     * Unified, no-secrets config status for the SPA and for deployment diagnostics.
     */
    public Map<String, Object> getUnifiedConfigStatus() {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("googleConfigured", isGoogleConfigured());
        root.put("stravaConfigured", isStravaConfigured());
        root.put("aiConfigured", isAiConfigured());
        root.put("billingCheckoutConfigured", isCheckoutFullyConfigured());

        Map<String, Object> strava = getStravaStatus();
        root.put("strava", strava);

        Map<String, Object> ai = new LinkedHashMap<>();
        ai.put("configured", isAiConfigured());
        ai.put("provider", aiProvider);
        ai.put("model", aiModel);
        root.put("ai", ai);

        Map<String, Object> billing = new LinkedHashMap<>();
        billing.put("configured", isCheckoutFullyConfigured());
        billing.put("provider", "stripe");
        if (priceDisplayLabel != null && !priceDisplayLabel.isBlank()) {
            billing.put("priceLabel", priceDisplayLabel.trim());
        }
        billing.put("publicBaseUrl", publicBaseUrl);
        billing.put("webhookSecretPresent", isPresent(stripeWebhookSecret));
        root.put("billing", billing);

        // NOTE: we intentionally do not return secrets.
        return root;
    }
}

