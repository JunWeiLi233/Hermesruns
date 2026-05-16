package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class StravaTokenService {

    private static final long STRAVA_LINK_REQUEST_TTL_MS = 10 * 60 * 1000L;

    private static final Logger log = LoggerFactory.getLogger(StravaTokenService.class);

    private final RunnerRepository runnerRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final RestTemplate restTemplate;
    private final SystemConfigService systemConfigService;

    @Value("${strava.client.id:}")
    private String stravaClientId;

    @Value("${strava.client.secret:}")
    private String stravaClientSecret;

    @Value("${app.strava.redirect-uri:http://localhost:8080/api/auth/strava/callback}")
    private String stravaRedirectUri;

    public StravaTokenService(RunnerRepository runnerRepository,
                              SecretEncryptionService secretEncryptionService,
                              RestTemplate restTemplate,
                              SystemConfigService systemConfigService) {
        this.runnerRepository = runnerRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.restTemplate = restTemplate;
        this.systemConfigService = systemConfigService;
    }

    public boolean isStravaConfigured() {
        return systemConfigService.isStravaConfigured();
    }

    public boolean isRunnerStravaLinked(Runner runner) {
        return runner.getStravaAthleteId() != null
                && runner.getStravaRefreshToken() != null
                && !runner.getStravaRefreshToken().isBlank();
    }

    public String buildStravaAuthUrl(String state) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString("https://www.strava.com/oauth/authorize")
                .queryParam("client_id", stravaClientId)
                .queryParam("redirect_uri", stravaRedirectUri)
                .queryParam("response_type", "code")
                .queryParam("approval_prompt", "auto")
                .queryParam("scope", "read,activity:read_all");

        if (state != null && !state.isBlank()) {
            builder.queryParam("state", state);
        }
        return builder.toUriString();
    }

    public String resolveRunnerStravaAccessToken(Runner runner) {
        String storedAccessToken = runner.getStravaAccessToken();
        if (storedAccessToken == null || storedAccessToken.isBlank()) {
            return null;
        }

        String decryptedAccessToken = secretEncryptionService.decrypt(storedAccessToken);
        String storedRefreshToken = runner.getStravaRefreshToken();
        String decryptedRefreshToken = secretEncryptionService.decrypt(storedRefreshToken);

        if (secretEncryptionService.isConfigured()
                && (!secretEncryptionService.isEncrypted(storedAccessToken)
                || (storedRefreshToken != null && !storedRefreshToken.isBlank() && !secretEncryptionService.isEncrypted(storedRefreshToken)))) {
            runner.setStravaAccessToken(secretEncryptionService.encrypt(decryptedAccessToken));
            runner.setStravaRefreshToken(secretEncryptionService.encrypt(decryptedRefreshToken));
            runnerRepository.save(runner);
        }

        Long expiresAt = runner.getStravaTokenExpiresAt();
        if (expiresAt != null && expiresAt < (System.currentTimeMillis() / 1000) + 300) {
            String refreshed = refreshStravaToken(runner, decryptedRefreshToken);
            if (refreshed != null) return refreshed;
        }

        return decryptedAccessToken;
    }

    public String refreshStravaToken(Runner runner, String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !isStravaConfigured()) return null;
        try {
            RestTemplate rest = this.restTemplate;
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", stravaClientId);
            form.add("client_secret", stravaClientSecret);
            form.add("grant_type", "refresh_token");
            form.add("refresh_token", refreshToken);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            @SuppressWarnings("unchecked")
            Map<String, Object> body = rest.postForObject(
                    "https://www.strava.com/oauth/token",
                    new HttpEntity<>(form, headers),
                    Map.class);

            if (body == null) return null;

            String newAccess = stringValue(body.get("access_token"));
            String newRefresh = stringValue(body.get("refresh_token"));
            Long newExpires = longValue(body.get("expires_at"));

            if (newAccess != null && !newAccess.isBlank()) {
                runner.setStravaAccessToken(secretEncryptionService.encrypt(newAccess));
                if (newRefresh != null && !newRefresh.isBlank()) {
                    runner.setStravaRefreshToken(secretEncryptionService.encrypt(newRefresh));
                }
                if (newExpires != null) runner.setStravaTokenExpiresAt(newExpires);
                runnerRepository.save(runner);
                return newAccess;
            }
        } catch (Exception e) {
            log.warn("Strava token refresh failed for runner {}: {}", runner.getId(), e.getMessage());
        }
        return null;
    }

    public String createProfileLinkState(Runner runner) {
        long expiresAtMs = System.currentTimeMillis() + STRAVA_LINK_REQUEST_TTL_MS;
        String payload = runner.getId() + ":" + expiresAtMs + ":" + blankToEmpty(runner.getSessionToken());
        String encodedPayload = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "profile-link:" + encodedPayload + "." + signProfileLinkPayload(payload);
    }

    private String signProfileLinkPayload(String payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] signature = digest.digest((payload + ":" + stravaClientSecret).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(signature);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    public Optional<PendingStravaLinkRequest> decodeProfileLinkState(String state) {
        if (!isProfileLinkState(state)) {
            return Optional.empty();
        }
        String encodedPayload = state.substring("profile-link:".length());
        String[] parts = encodedPayload.split("\\.", 2);
        if (parts.length != 2) {
            return Optional.empty();
        }
        String payload;
        try {
            payload = new String(java.util.Base64.getUrlDecoder().decode(parts[0]), java.nio.charset.StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }

        String expectedSignature = signProfileLinkPayload(payload);
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                parts[1].getBytes(java.nio.charset.StandardCharsets.UTF_8)
        )) {
            return Optional.empty();
        }

        String[] payloadParts = payload.split(":", 3);
        if (payloadParts.length < 2) {
            return Optional.empty();
        }
        try {
            long runnerId = Long.parseLong(payloadParts[0]);
            long expiresAtMs = Long.parseLong(payloadParts[1]);
            if (expiresAtMs < System.currentTimeMillis()) {
                return Optional.empty();
            }
            String sessionFingerprint = payloadParts.length >= 3 ? payloadParts[2] : "";
            return Optional.of(new PendingStravaLinkRequest(runnerId, expiresAtMs, sessionFingerprint));
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    public boolean isProfileLinkState(String state) {
        return state != null && state.startsWith("profile-link:");
    }

    public String stravaEmail(Long athleteId) {
        return "strava+" + athleteId + "@hermes.local";
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Long.parseLong(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value;
    }

    public record PendingStravaLinkRequest(Long runnerId, long expiresAtMs, String sessionFingerprint) {}
}
