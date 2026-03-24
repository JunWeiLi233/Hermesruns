package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Global Garmin Developer app credentials from the environment and helpers
 * for whether a runner relies on them vs per-user keys.
 */
@Component
public class GarminOAuthSettings {

    @Value("${garmin.consumer.key:}")
    private String consumerKey;

    @Value("${garmin.consumer.secret:}")
    private String consumerSecret;

    @Value("${app.garmin.redirect-uri:http://localhost:8080/api/auth/garmin/callback}")
    private String redirectUri;

    /**
     * Optional Wellness/Activity API URL for a signed GET using the user's OAuth access token
     * to resolve the Garmin {@code userId} (for webhooks). Set from your Garmin portal docs if needed.
     */
    @Value("${garmin.api.user-id-url:}")
    private String userIdLookupUrl;

    public String getConsumerKey() {
        return consumerKey;
    }

    public String getConsumerSecret() {
        return consumerSecret;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public Optional<String> getUserIdLookupUrl() {
        if (userIdLookupUrl == null || userIdLookupUrl.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(userIdLookupUrl.trim());
    }

    public boolean isGlobalConsumerPairConfigured() {
        return notBlank(consumerKey) && notBlank(consumerSecret);
    }

    /**
     * Runner saved their own Garmin Developer Program consumer key + secret in Hermes.
     */
    public boolean hasPerRunnerDeveloperApp(Runner runner) {
        if (runner == null) {
            return false;
        }
        return notBlank(runner.getGarminConsumerKey()) && notBlank(runner.getGarminConsumerSecret());
    }

    /**
     * OAuth uses {@link #getConsumerKey()} / {@link #getConsumerSecret()} from the server env, not per-runner keys.
     */
    public boolean usesServerKeysFor(Runner runner) {
        return isGlobalConsumerPairConfigured() && !hasPerRunnerDeveloperApp(runner);
    }

    public boolean canConnectGarmin(SecretEncryptionService encryption, Runner runner) {
        if (encryption == null || !encryption.isConfigured()) {
            return false;
        }
        if (hasPerRunnerDeveloperApp(runner)) {
            return true;
        }
        return isGlobalConsumerPairConfigured();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
