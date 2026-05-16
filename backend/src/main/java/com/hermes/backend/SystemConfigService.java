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
    @Value("${app.ai.course-map.provider:qwen-local}")
    private String courseMapAiProvider;
    @Value("${app.ai.agent.provider:}")
    private String aiAgentProvider;
    @Value("${app.ai.agent.letta.base-url:}")
    private String lettaBaseUrl;
    @Value("${app.ai.agent.letta.agent-id:}")
    private String lettaAgentId;

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
        String mode = configured ? "configured" : "config-missing";

        String reason = null;
        if (!clientIdPresent) {
            reason = "STRAVA_CLIENT_ID is missing/blank.";
        } else if (!clientSecretPresent) {
            reason = "STRAVA_CLIENT_SECRET is missing/blank.";
        } else if (!encryptionKeyConfigured) {
            reason = "APP_DATA_ENCRYPTION_KEY is missing/blank (required to store Strava tokens).";
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("mode", mode);
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

    public boolean isCourseMapAiConfigured() {
        String provider = courseMapAiProvider == null
                ? ""
                : courseMapAiProvider.trim().toLowerCase(java.util.Locale.ROOT);
        if (provider.isBlank() || "qwen-local".equals(provider) || "local-qwen".equals(provider) || "qwen".equals(provider)) {
            return true;
        }
        return isAiConfigured();
    }

    public boolean isAiAgentConfigured() {
        String provider = aiAgentProvider == null ? "" : aiAgentProvider.trim().toLowerCase(java.util.Locale.ROOT);
        if (!"letta".equals(provider)) {
            return false;
        }
        return isPresent(lettaBaseUrl) && isPresent(lettaAgentId);
    }

    public boolean isCheckoutFullyConfigured() {
        return isPresent(stripeSecretKey) && isPresent(stripePriceProMonthly);
    }

    /**
     * Minimal config status for the public SPA (no internal details).
     */
    public Map<String, Object> getPublicConfigStatus() {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("googleConfigured", isGoogleConfigured());
        root.put("stravaConfigured", isStravaConfigured());
        root.put("aiConfigured", isAiConfigured());
        root.put("billingCheckoutConfigured", isCheckoutFullyConfigured());

        Map<String, Object> ai = new LinkedHashMap<>();
        ai.put("configured", isAiConfigured());
        ai.put("provider", aiProvider);
        ai.put("model", aiModel);
        ai.put("courseMapConfigured", isCourseMapAiConfigured());
        ai.put("courseMapProvider", courseMapAiProvider);
        ai.put("agentConfigured", isAiAgentConfigured());
        ai.put("agentProvider", aiAgentProvider == null ? "" : aiAgentProvider);
        root.put("ai", ai);

        Map<String, Object> billing = new LinkedHashMap<>();
        billing.put("configured", isCheckoutFullyConfigured());
        billing.put("provider", "stripe");
        if (priceDisplayLabel != null && !priceDisplayLabel.isBlank()) {
            billing.put("priceLabel", priceDisplayLabel.trim());
        }
        root.put("billing", billing);
        return root;
    }

    /**
     * Unified, detailed config status for deployment diagnostics (Admins only).
     */
    public Map<String, Object> getAdminConfigStatus() {
        Map<String, Object> root = getPublicConfigStatus();

        Map<String, Object> strava = getStravaStatus();
        root.put("strava", strava);

        Map<String, Object> billing = (Map<String, Object>) root.get("billing");
        billing.put("publicBaseUrl", publicBaseUrl);
        billing.put("webhookSecretPresent", isPresent(stripeWebhookSecret));

        // NOTE: we intentionally do not return secrets even for admins.
        return root;
    }
}
