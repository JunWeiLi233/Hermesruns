package com.hermes.backend;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Garmin Connect Developer API integration.
 *
 * Uses OAuth 1.0a for user authorization and receives activity pushes
 * via webhook when users sync their Garmin devices.
 *
 * Apply for API access at: https://developer.garmin.com/gc-developer-program/activity-api/
 *
 * <p>After the runner authorizes, Hermes uses their OAuth token to call the Garmin Wellness REST API
 * (same host as the official libraries) to list activities and download FIT files — similar to
 * consumer apps that link a Garmin watch.
 */
@RestController
@RequestMapping("/api")
public class GarminController {
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Wellness REST base (OAuth 1.0a signed GET); see e.g. {@code activities}, {@code backfill/activities}. */
    private static final String GARMIN_WELLNESS_REST = "https://healthapi.garmin.com/wellness-api/rest/";

    private record GarminAppConfig(String consumerKey, String consumerSecret, String redirectUri) {
        boolean isConfigured() {
            return consumerKey != null && !consumerKey.isBlank()
                    && consumerSecret != null && !consumerSecret.isBlank();
        }
    }

    private static final Logger log = LoggerFactory.getLogger(GarminController.class);

    private static final String GARMIN_REQUEST_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/request_token";
    private static final String GARMIN_AUTHORIZE_URL = "https://connect.garmin.com/oauthConfirm";
    private static final String GARMIN_ACCESS_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/access_token";

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final SecretEncryptionService encryptionService;
    private final List<ActivityFileParser> parsers;
    private final GarminOAuthSettings garminOAuthSettings;

    /** Temporary store for OAuth 1.0a request tokens (token → tokenSecret) */
    private final ConcurrentHashMap<String, String> pendingTokens = new ConcurrentHashMap<>();
    /** Map request token → Hermes session token so we know which user started the flow */
    private final ConcurrentHashMap<String, String> pendingSession = new ConcurrentHashMap<>();

    private final ConcurrentMap<Long, GarminSyncTracker> garminSyncStates = new ConcurrentHashMap<>();

    public GarminController(RunnerRepository runnerRepository,
                            AuthService authService,
                            ActivityRepository activityRepository,
                            ActivityPointRepository activityPointRepository,
                            SecretEncryptionService encryptionService,
                            List<ActivityFileParser> parsers,
                            GarminOAuthSettings garminOAuthSettings) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.encryptionService = encryptionService;
        this.parsers = parsers;
        this.garminOAuthSettings = garminOAuthSettings;
    }

    // ── Provider check ──

    @GetMapping("/auth/garmin/configured")
    public ResponseEntity<Map<String, Object>> isConfigured(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        Runner runner = runnerOpt.orElse(null);
        GarminAppConfig config = resolveConfig(runner);
        return ResponseEntity.ok(Map.of(
                "garminConfigured", config.isConfigured() && encryptionService.isConfigured(),
                "usesCustomConfig", garminOAuthSettings.hasPerRunnerDeveloperApp(runner),
                "usesServerGarminKeys", garminOAuthSettings.usesServerKeysFor(runner),
                "redirectUri", config.redirectUri() != null ? config.redirectUri() : ""
        ));
    }

    @GetMapping("/auth/garmin/config")
    public ResponseEntity<?> getGarminConfig(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Runner runner = runnerOpt.get();
        GarminAppConfig config = resolveConfig(runner);
        return ResponseEntity.ok(Map.of(
                "consumerKey", config.consumerKey() != null ? config.consumerKey() : "",
                "redirectUri", config.redirectUri() != null ? config.redirectUri() : "",
                "hasSecret", config.consumerSecret() != null && !config.consumerSecret().isBlank(),
                "usesCustomConfig", garminOAuthSettings.hasPerRunnerDeveloperApp(runner)
        ));
    }

    @PutMapping("/auth/garmin/config")
    public ResponseEntity<?> updateGarminConfig(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                                @RequestBody Map<String, String> body) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!encryptionService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "APP_DATA_ENCRYPTION_KEY is required before saving Garmin credentials."));
        }

        Runner runner = runnerOpt.get();
        String consumerKeyInput = normalize(body.get("consumerKey"));
        String consumerSecretInput = normalize(body.get("consumerSecret"));
        String redirectUriInput = normalize(body.get("redirectUri"));

        if (consumerKeyInput.isBlank() && consumerSecretInput.isBlank() && redirectUriInput.isBlank()) {
            runner.setGarminConsumerKey(null);
            runner.setGarminConsumerSecret(null);
            runner.setGarminRedirectUri(null);
            runnerRepository.save(runner);
            return ResponseEntity.ok(Map.of("saved", true, "cleared", true));
        }

        String storedSecret = normalize(runner.getGarminConsumerSecret());
        if (consumerKeyInput.isBlank() || (consumerSecretInput.isBlank() && storedSecret.isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Both Garmin consumer key and secret are required."));
        }

        String effectiveRedirect = redirectUriInput.isBlank() ? garminOAuthSettings.getRedirectUri() : redirectUriInput;
        runner.setGarminConsumerKey(consumerKeyInput);
        if (!consumerSecretInput.isBlank()) {
            runner.setGarminConsumerSecret(encryptionService.encrypt(consumerSecretInput));
        }
        runner.setGarminRedirectUri(effectiveRedirect);
        runnerRepository.save(runner);

        return ResponseEntity.ok(Map.of(
                "saved", true,
                "usesCustomConfig", true,
                "redirectUri", effectiveRedirect
        ));
    }

    // ── Step 1: Start OAuth 1.0a — get request token, redirect user to Garmin ──

    @GetMapping("/auth/garmin/start")
    public Object startGarminAuth(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not authenticated"));
        }
        Runner runner = runnerOpt.get();
        GarminAppConfig config = resolveConfig(runner);

        if (!config.isConfigured() || !encryptionService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Garmin API not configured"));
        }

        try {
            // Request token
            String nonce = generateNonce();
            String timestamp = String.valueOf(Instant.now().getEpochSecond());

            TreeMap<String, String> params = new TreeMap<>();
            params.put("oauth_consumer_key", config.consumerKey());
            params.put("oauth_signature_method", "HMAC-SHA1");
            params.put("oauth_timestamp", timestamp);
            params.put("oauth_nonce", nonce);
            params.put("oauth_version", "1.0");
            params.put("oauth_callback", config.redirectUri());

            String signature = sign("POST", GARMIN_REQUEST_TOKEN_URL, params, config.consumerSecret(), "");
            params.put("oauth_signature", signature);

            String authHeaderValue = buildOAuthHeader(params);

            RestTemplate rest = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", authHeaderValue);
            HttpEntity<String> entity = new HttpEntity<>("", headers);

            ResponseEntity<String> response = rest.exchange(
                    GARMIN_REQUEST_TOKEN_URL, HttpMethod.POST, entity, String.class);

            Map<String, String> tokenResponse = parseFormBody(response.getBody());
            String oauthToken = tokenResponse.get("oauth_token");
            String oauthTokenSecret = tokenResponse.get("oauth_token_secret");

            if (oauthToken == null || oauthTokenSecret == null) {
                log.error("Garmin request token response missing tokens: {}", response.getBody());
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                        .body(Map.of("error", "Failed to get Garmin request token"));
            }

            // Store for callback
            pendingTokens.put(oauthToken, oauthTokenSecret);
            String sessionToken = authHeader.replace("Bearer ", "").trim();
            pendingSession.put(oauthToken, sessionToken);

            String authorizeUrl = GARMIN_AUTHORIZE_URL + "?oauth_token=" + enc(oauthToken);
            return ResponseEntity.ok(Map.of("authorizeUrl", authorizeUrl));

        } catch (Exception e) {
            log.error("Garmin OAuth start failed", e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Garmin OAuth request failed: " + e.getMessage()));
        }
    }

    // ── Step 2: OAuth callback — exchange for access token ──

    @GetMapping("/auth/garmin/callback")
    public RedirectView handleGarminCallback(
            @RequestParam("oauth_token") String oauthToken,
            @RequestParam(value = "oauth_verifier", required = false) String oauthVerifier) {

        String tokenSecret = pendingTokens.remove(oauthToken);
        String sessionToken = pendingSession.remove(oauthToken);

        if (tokenSecret == null || sessionToken == null) {
            log.warn("Garmin callback: unknown or expired request token");
            return new RedirectView("/profile#garmin=error");
        }

        Optional<Runner> runnerOpt2 = authService.findByAuthorizationHeader("Bearer " + sessionToken);
        if (runnerOpt2.isEmpty()) {
            log.warn("Garmin callback: session not found");
            return new RedirectView("/profile#garmin=error");
        }
        Runner runner = runnerOpt2.get();
        GarminAppConfig config = resolveConfig(runner);
        if (!config.isConfigured() || !encryptionService.isConfigured()) {
            return new RedirectView("/profile#garmin=error");
        }

        try {
            String nonce = generateNonce();
            String timestamp = String.valueOf(Instant.now().getEpochSecond());

            TreeMap<String, String> params = new TreeMap<>();
            params.put("oauth_consumer_key", config.consumerKey());
            params.put("oauth_token", oauthToken);
            params.put("oauth_signature_method", "HMAC-SHA1");
            params.put("oauth_timestamp", timestamp);
            params.put("oauth_nonce", nonce);
            params.put("oauth_version", "1.0");
            if (oauthVerifier != null) params.put("oauth_verifier", oauthVerifier);

            String signature = sign("POST", GARMIN_ACCESS_TOKEN_URL, params, config.consumerSecret(), tokenSecret);
            params.put("oauth_signature", signature);

            String authHeaderValue = buildOAuthHeader(params);

            RestTemplate rest = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", authHeaderValue);
            HttpEntity<String> entity = new HttpEntity<>("", headers);

            ResponseEntity<String> response = rest.exchange(
                    GARMIN_ACCESS_TOKEN_URL, HttpMethod.POST, entity, String.class);

            Map<String, String> accessResponse = parseFormBody(response.getBody());
            String accessToken = accessResponse.get("oauth_token");
            String accessTokenSecret = accessResponse.get("oauth_token_secret");

            if (accessToken == null || accessTokenSecret == null) {
                log.error("Garmin access token response missing tokens: {}", response.getBody());
                return new RedirectView("/profile#garmin=error");
            }

            log.debug("Garmin access token response keys: {}", accessResponse.keySet());

            // Store encrypted user tokens — these are the credentials for Garmin API calls on behalf of this user
            runner.setGarminAccessToken(encryptionService.encrypt(accessToken));
            runner.setGarminAccessTokenSecret(encryptionService.encrypt(accessTokenSecret));
            runner.setGarminUserId(extractGarminUserIdFromOAuthResponse(accessResponse, accessToken));
            runnerRepository.save(runner);

            String resolved = resolveGarminUserIdViaWellnessApi(runner);
            if (resolved != null && !resolved.isBlank() && !resolved.equals(runner.getGarminUserId())) {
                runner.setGarminUserId(resolved);
                runnerRepository.save(runner);
            }

            log.info("Garmin connected for runner {} (garminUserId={})", runner.getId(), runner.getGarminUserId());
            Long linkedRunnerId = runner.getId();
            CompletableFuture.runAsync(() -> runGarminActivitySync(linkedRunnerId));
            return new RedirectView("/profile#garmin=success");

        } catch (Exception e) {
            log.error("Garmin OAuth callback failed", e);
            return new RedirectView("/profile#garmin=error");
        }
    }

    // ── Garmin status ──

    @GetMapping("/auth/garmin/status")
    public ResponseEntity<?> garminStatus(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Runner runner = runnerOpt.get();

        boolean connected = runner.getGarminAccessToken() != null && !runner.getGarminAccessToken().isBlank();
        return ResponseEntity.ok(Map.of(
                "connected", connected,
                "garminUserId", runner.getGarminUserId() != null ? runner.getGarminUserId() : ""
        ));
    }

    /**
     * Re-resolve Garmin {@code userId} using the stored user access token (e.g. if webhooks do not match).
     * Requires {@code garmin.api.user-id-url} if your Garmin project uses the Wellness user-id endpoint.
     */
    @PostMapping("/auth/garmin/refresh-user")
    public ResponseEntity<?> refreshGarminUserId(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Runner runner = runnerOpt.get();
        if (runner.getGarminAccessToken() == null || runner.getGarminAccessToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Garmin not connected"));
        }
        String resolved = resolveGarminUserIdViaWellnessApi(runner);
        if (resolved == null || resolved.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "updated", false,
                    "garminUserId", runner.getGarminUserId() != null ? runner.getGarminUserId() : "",
                    "message", "User ID lookup skipped or failed (configure garmin.api.user-id-url if required)."
            ));
        }
        if (!resolved.equals(runner.getGarminUserId())) {
            runner.setGarminUserId(resolved);
            runnerRepository.save(runner);
        }
        return ResponseEntity.ok(Map.of(
                "updated", true,
                "garminUserId", runner.getGarminUserId() != null ? runner.getGarminUserId() : ""
        ));
    }

    /**
     * Pull recent activities from Garmin Wellness API (like partner apps after watch link) and import runs from FIT.
     */
    @PostMapping("/auth/garmin/sync")
    public ResponseEntity<?> startGarminSync(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Runner runner = runnerOpt.get();
        if (runner.getGarminAccessToken() == null || runner.getGarminAccessToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Garmin not connected"));
        }
        CompletableFuture.runAsync(() -> runGarminActivitySync(runner.getId()));
        return ResponseEntity.ok(Map.of("message", "Garmin sync started"));
    }

    @GetMapping("/auth/garmin/sync-status")
    public ResponseEntity<?> getGarminSyncStatus(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        GarminSyncTracker tracker = garminSyncStates.get(runnerOpt.get().getId());
        if (tracker == null) {
            return ResponseEntity.ok(GarminSyncStatusResponse.idle());
        }
        return ResponseEntity.ok(tracker.snapshot());
    }

    // ── Disconnect Garmin ──

    @PostMapping("/auth/garmin/disconnect")
    public ResponseEntity<?> disconnectGarmin(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Runner runner = runnerOpt.get();

        runner.setGarminAccessToken(null);
        runner.setGarminAccessTokenSecret(null);
        runner.setGarminUserId(null);
        runnerRepository.save(runner);

        return ResponseEntity.ok(Map.of("success", true));
    }

    // ── Webhook: Garmin pushes activity data here ──

    /**
     * Garmin Activity Push endpoint.
     * When a user syncs their Garmin device, Garmin POSTs activity file info here.
     * The push body contains activity summaries; we then fetch the FIT file.
     */
    @PostMapping("/garmin/webhook")
    public ResponseEntity<?> garminActivityWebhook(@RequestBody Map<String, Object> payload) {
        log.info("Garmin webhook received: {}", payload);

        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> activities = (List<Map<String, Object>>) payload.get("activityFiles");
            if (activities == null) {
                // Try alternative payload format (activity details)
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> details = (List<Map<String, Object>>) payload.get("activityDetails");
                if (details != null) activities = details;
            }

            if (activities == null || activities.isEmpty()) {
                log.info("Garmin webhook: no activity files in payload");
                return ResponseEntity.ok(Map.of("status", "no_activities"));
            }

            int imported = 0, skipped = 0;

            for (Map<String, Object> actEntry : activities) {
                String userId = String.valueOf(actEntry.get("userId"));
                String callbackUrl = (String) actEntry.get("callbackURL");

                Optional<Runner> runnerOpt = runnerRepository.findByGarminUserId(userId);
                if (runnerOpt.isEmpty()) {
                    log.warn("Garmin webhook: unknown userId={}", userId);
                    skipped++;
                    continue;
                }

                Runner runner = runnerOpt.get();

                if (callbackUrl != null && !callbackUrl.isBlank()) {
                    // Fetch FIT file from Garmin callback URL
                    try {
                        byte[] fitData = fetchGarminFile(callbackUrl, runner);
                        if (fitData != null && fitData.length > 0) {
                            ImportResult result = importFitData(runner, fitData, callbackUrl);
                            imported += result.importedActivities();
                            skipped += result.skippedDuplicates();
                        }
                    } catch (Exception e) {
                        log.error("Garmin webhook: failed to fetch/import file for userId={}", userId, e);
                        skipped++;
                    }
                } else {
                    // No callback URL — try to import from summary data
                    log.info("Garmin webhook: no callbackURL for userId={}, skipping", userId);
                    skipped++;
                }
            }

            log.info("Garmin webhook processed: imported={}, skipped={}", imported, skipped);
            return ResponseEntity.ok(Map.of("imported", imported, "skipped", skipped));

        } catch (Exception e) {
            log.error("Garmin webhook processing failed", e);
            return ResponseEntity.ok(Map.of("status", "error"));
        }
    }

    /**
     * Garmin deregistration endpoint — called when user revokes access.
     */
    @PostMapping("/garmin/deregistration")
    public ResponseEntity<?> garminDeregistration(@RequestBody Map<String, Object> payload) {
        log.info("Garmin deregistration: {}", payload);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> deregistrations = (List<Map<String, Object>>) payload.get("deregistrations");
        if (deregistrations != null) {
            for (Map<String, Object> entry : deregistrations) {
                String userId = String.valueOf(entry.get("userId"));
                runnerRepository.findByGarminUserId(userId).ifPresent(runner -> {
                    runner.setGarminAccessToken(null);
                    runner.setGarminAccessTokenSecret(null);
                    runner.setGarminUserId(null);
                    runnerRepository.save(runner);
                    log.info("Garmin deregistered runner {} (garminUserId={})", runner.getId(), userId);
                });
            }
        }

        return ResponseEntity.ok().build();
    }

    // ── Internal helpers ──

    private byte[] fetchGarminFile(String callbackUrl, Runner runner) {
        return signedOAuthGet(callbackUrl, runner);
    }

    /** OAuth 1.0a signed GET using the runner's Garmin access token (user context). */
    private byte[] signedOAuthGet(String fullUrl, Runner runner) {
        GarminAppConfig config = resolveConfig(runner);
        String accessToken = encryptionService.decrypt(runner.getGarminAccessToken());
        String accessTokenSecret = encryptionService.decrypt(runner.getGarminAccessTokenSecret());

        String nonce = generateNonce();
        String timestamp = String.valueOf(Instant.now().getEpochSecond());

        TreeMap<String, String> params = new TreeMap<>();
        params.put("oauth_consumer_key", config.consumerKey());
        params.put("oauth_token", accessToken);
        params.put("oauth_signature_method", "HMAC-SHA1");
        params.put("oauth_timestamp", timestamp);
        params.put("oauth_nonce", nonce);
        params.put("oauth_version", "1.0");

        String signature = sign("GET", fullUrl.split("\\?")[0], params, config.consumerSecret(), accessTokenSecret);
        params.put("oauth_signature", signature);

        RestTemplate rest = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", buildOAuthHeader(params));
        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<byte[]> response = rest.exchange(fullUrl, HttpMethod.GET, entity, byte[].class);
        return response.getBody();
    }

    /**
     * Garmin sometimes returns {@code userId} in the access-token form body; otherwise derive from {@code oauth_token}.
     */
    private static String extractGarminUserIdFromOAuthResponse(Map<String, String> params, String oauthToken) {
        for (String k : List.of("userId", "user_id", "oauth_user_id", "USER_ID")) {
            String v = params.get(k);
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        for (Map.Entry<String, String> e : params.entrySet()) {
            String key = e.getKey();
            if (key == null) continue;
            String kl = key.toLowerCase(Locale.ROOT);
            if (kl.contains("user") && kl.contains("id")) {
                String v = e.getValue();
                if (v != null && !v.isBlank()) {
                    return v.trim();
                }
            }
        }
        if (oauthToken != null && oauthToken.contains("-")) {
            return oauthToken.substring(0, oauthToken.indexOf('-'));
        }
        return oauthToken != null ? oauthToken.trim() : "";
    }

    /**
     * Optional second step: signed GET to Garmin's user-id endpoint (see {@code garmin.api.user-id-url}).
     */
    private String resolveGarminUserIdViaWellnessApi(Runner runner) {
        Optional<String> urlOpt = garminOAuthSettings.getUserIdLookupUrl();
        if (urlOpt.isEmpty()) {
            return null;
        }
        try {
            byte[] body = signedOAuthGet(urlOpt.get(), runner);
            if (body == null || body.length == 0) {
                return null;
            }
            return parseUserIdFromWellnessResponse(new String(body, StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("Garmin userId lookup via {} failed: {}", urlOpt.get(), e.getMessage());
            return null;
        }
    }

    private static String parseUserIdFromWellnessResponse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        if (s.startsWith("{")) {
            try {
                JsonNode root = JSON.readTree(s);
                for (String f : List.of("userId", "user_id", "userProfileId", "id")) {
                    JsonNode n = root.get(f);
                    if (n != null && n.isString()) {
                        String t = n.stringValue();
                        if (t != null && !t.isBlank()) {
                            return t.trim();
                        }
                    }
                    if (n != null && n.isNumber()) {
                        return n.stringValue();
                    }
                }
            } catch (Exception e) {
                log.debug("Garmin user id JSON parse failed", e);
            }
        }
        if (s.matches("\\d+")) {
            return s;
        }
        return null;
    }

    private ImportResult importFitData(Runner runner, byte[] fileData, String sourceRef) {
        String checksum = sha256(fileData);
        if (activityRepository.existsByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.GARMIN, checksum)) {
            return new ImportResult("GARMIN", 0, 0, 1, 0, "Duplicate");
        }

        // Try each parser (FIT first since Garmin primarily sends FIT)
        for (ActivityFileParser parser : parsers) {
            if (parser.supports("fit")) {
                try {
                    ParsedActivityData parsed = parser.parse("garmin_webhook.fit", fileData);
                    if (parsed == null) continue;

                    if (parsed.activityType() != ActivityType.RUN) {
                        return new ImportResult("GARMIN", 0, 0, 0, 1, "Non-run");
                    }

                    Activity activity = new Activity();
                    activity.setRunner(runner);
                    activity.setProvider(ImportProvider.GARMIN);
                    activity.setSourceChecksum(checksum);
                    activity.setSourceFileName(sourceRef);
                    activity.setName(parsed.name() != null ? parsed.name() : "Garmin Run");
                    activity.setActivityType(parsed.activityType());
                    activity.setStartTime(parsed.startTime());
                    if (parsed.startTime() != null) {
                        activity.setStartDate(parsed.startTime().toLocalDate().toString());
                    }
                    activity.setDistanceMeters(parsed.distanceMeters());
                    activity.setDistanceKm(parsed.distanceMeters() / 1000.0);
                    activity.setDurationSeconds(parsed.durationSeconds());
                    activity.setMovingTimeSeconds(parsed.durationSeconds() != null ? parsed.durationSeconds().intValue() : 0);
                    if (parsed.averageHeartRate() != null && parsed.averageHeartRate() > 0) activity.setAverageHeartRate(parsed.averageHeartRate());
                    if (parsed.maxHeartRate() != null && parsed.maxHeartRate() > 0) activity.setMaxHeartRate(parsed.maxHeartRate());
                    activity.setCreatedAt(java.time.LocalDateTime.now());

                    activityRepository.save(activity);

                    // Save GPS points
                    int pointsSaved = 0;
                    if (parsed.points() != null) {
                        List<ActivityPoint> points = new ArrayList<>();
                        int seq = 0;
                        for (ParsedTrackPoint pt : parsed.points()) {
                            ActivityPoint ap = new ActivityPoint();
                            ap.setActivity(activity);
                            ap.setLatitude(pt.latitude());
                            ap.setLongitude(pt.longitude());
                            ap.setSequenceIndex(seq++);
                            points.add(ap);
                        }
                        activityPointRepository.saveAll(points);
                        pointsSaved = points.size();
                    }

                    log.info("Garmin webhook imported: {} — {} km, {} points",
                            activity.getName(), String.format("%.2f", activity.getDistanceKm()), pointsSaved);
                    return new ImportResult("GARMIN", 1, pointsSaved, 0, 0, "OK");
                } catch (Exception e) {
                    log.error("Garmin FIT parse failed", e);
                }
            }
        }
        return new ImportResult("GARMIN", 0, 0, 0, 0, "No suitable parser");
    }

    private static String sha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    // ── OAuth 1.0a helpers ──

    private GarminAppConfig resolveConfig(Runner runner) {
        if (runner != null && garminOAuthSettings.hasPerRunnerDeveloperApp(runner)) {
            return new GarminAppConfig(
                    runner.getGarminConsumerKey(),
                    encryptionService.decrypt(runner.getGarminConsumerSecret()),
                    normalize(runner.getGarminRedirectUri()).isBlank()
                            ? garminOAuthSettings.getRedirectUri()
                            : normalize(runner.getGarminRedirectUri())
            );
        }
        return new GarminAppConfig(
                garminOAuthSettings.getConsumerKey(),
                garminOAuthSettings.getConsumerSecret(),
                garminOAuthSettings.getRedirectUri()
        );
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String generateNonce() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String sign(String method, String url, TreeMap<String, String> params,
                               String consumerSecret, String tokenSecret) {
        StringBuilder paramStr = new StringBuilder();
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (paramStr.length() > 0) paramStr.append('&');
            paramStr.append(enc(e.getKey())).append('=').append(enc(e.getValue()));
        }

        String baseString = method.toUpperCase() + "&" + enc(url) + "&" + enc(paramStr.toString());
        String signingKey = enc(consumerSecret) + "&" + enc(tokenSecret);

        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(signingKey.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            byte[] raw = mac.doFinal(baseString.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(raw);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA1 signing failed", e);
        }
    }

    private static String buildOAuthHeader(Map<String, String> params) {
        StringBuilder sb = new StringBuilder("OAuth ");
        boolean first = true;
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (e.getKey().startsWith("oauth_")) {
                if (!first) sb.append(", ");
                sb.append(enc(e.getKey())).append("=\"").append(enc(e.getValue())).append("\"");
                first = false;
            }
        }
        return sb.toString();
    }

    private static Map<String, String> parseFormBody(String body) {
        Map<String, String> map = new HashMap<>();
        if (body == null || body.isBlank()) return map;
        for (String pair : body.split("&")) {
            String[] kv = pair.split("=", 2);
            if (kv.length == 2) {
                map.put(java.net.URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                        java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
            }
        }
        return map;
    }

    // ── Wellness API: pull activities (user-authorized OAuth token) ──

    private void runGarminActivitySync(Long runnerId) {
        GarminSyncTracker tracker = garminSyncStates.computeIfAbsent(runnerId, id -> new GarminSyncTracker());
        tracker.markRunning();
        try {
            Optional<Runner> runnerOpt = runnerRepository.findById(runnerId);
            if (runnerOpt.isEmpty()) {
                tracker.markFailed("Runner not found");
                return;
            }
            Runner runner = runnerOpt.get();
            if (runner.getGarminAccessToken() == null || runner.getGarminAccessToken().isBlank()) {
                tracker.markFailed("Garmin not connected");
                return;
            }
            long now = Instant.now().getEpochSecond();
            long windowStart = now - 14L * 86400L;
            long backfillStart = now - 7L * 86400L;

            try {
                wellnessSignedGet("backfill/activities", Map.of(
                        "summaryStartTimeInSeconds", String.valueOf(backfillStart),
                        "summaryEndTimeInSeconds", String.valueOf(now)
                ), runner);
            } catch (Exception e) {
                log.debug("Garmin backfill skipped: {}", e.getMessage());
            }

            byte[] body = wellnessSignedGet("activities", Map.of(
                    "uploadStartTimeInSeconds", String.valueOf(windowStart),
                    "uploadEndTimeInSeconds", String.valueOf(now)
            ), runner);

            if (body == null || body.length == 0) {
                tracker.markCompleted();
                return;
            }
            processActivitySummaryJson(runner, new String(body, StandardCharsets.UTF_8), tracker);
            tracker.markCompleted();
        } catch (Exception e) {
            log.error("Garmin activity sync failed", e);
            tracker.markFailed(e.getMessage() != null ? e.getMessage() : "Sync failed");
        }
    }

    /**
     * Signed GET to {@link #GARMIN_WELLNESS_REST} + path; request query params participate in the OAuth signature.
     */
    private byte[] wellnessSignedGet(String pathRelative, Map<String, String> requestParams, Runner runner) {
        String baseUrl = GARMIN_WELLNESS_REST + pathRelative;
        GarminAppConfig config = resolveConfig(runner);
        String accessToken = encryptionService.decrypt(runner.getGarminAccessToken());
        String accessTokenSecret = encryptionService.decrypt(runner.getGarminAccessTokenSecret());

        String nonce = generateNonce();
        String timestamp = String.valueOf(Instant.now().getEpochSecond());

        TreeMap<String, String> params = new TreeMap<>();
        params.put("oauth_consumer_key", config.consumerKey());
        params.put("oauth_token", accessToken);
        params.put("oauth_signature_method", "HMAC-SHA1");
        params.put("oauth_timestamp", timestamp);
        params.put("oauth_nonce", nonce);
        params.put("oauth_version", "1.0");
        for (Map.Entry<String, String> e : requestParams.entrySet()) {
            params.put(e.getKey(), e.getValue());
        }

        String signature = sign("GET", baseUrl, params, config.consumerSecret(), accessTokenSecret);
        params.put("oauth_signature", signature);

        StringBuilder urlQuery = new StringBuilder();
        for (Map.Entry<String, String> e : requestParams.entrySet()) {
            if (urlQuery.length() > 0) urlQuery.append('&');
            urlQuery.append(enc(e.getKey())).append('=').append(enc(e.getValue()));
        }
        String fullUrl = baseUrl + "?" + urlQuery;

        RestTemplate rest = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", buildOAuthHeader(params));
        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<byte[]> response = rest.exchange(fullUrl, HttpMethod.GET, entity, byte[].class);
        return response.getBody();
    }

    private void processActivitySummaryJson(Runner runner, String json, GarminSyncTracker tracker) throws Exception {
        JsonNode root = JSON.readTree(json);
        List<JsonNode> nodes = new ArrayList<>();
        if (root.isArray()) {
            root.forEach(nodes::add);
        } else if (root.isObject()) {
            if (root.has("activities") && root.get("activities").isArray()) {
                root.get("activities").forEach(nodes::add);
            }
            if (root.has("activitySummaries") && root.get("activitySummaries").isArray()) {
                root.get("activitySummaries").forEach(nodes::add);
            }
            if (root.has("activitySummaryDTOs") && root.get("activitySummaryDTOs").isArray()) {
                root.get("activitySummaryDTOs").forEach(nodes::add);
            }
        }
        Set<String> seenCallbacks = new HashSet<>();
        for (JsonNode n : nodes) {
            String callback = firstNonBlankText(n, "callbackURL", "callbackUrl", "callback");
            if (callback == null || callback.isBlank()) {
                continue;
            }
            if (!seenCallbacks.add(callback)) {
                continue;
            }
            String type = firstNonBlankText(n, "activityType", "activityTypeKey", "sport");
            if (type != null && !isGarminLikelyRunning(type)) {
                tracker.incrementSkippedNonRuns();
                continue;
            }
            try {
                byte[] fit = fetchGarminFile(callback, runner);
                if (fit == null || fit.length == 0) {
                    continue;
                }
                ImportResult r = importFitData(runner, fit, callback);
                tracker.importResult(r);
            } catch (Exception ex) {
                log.warn("Garmin FIT import failed: {}", ex.getMessage());
            }
        }
    }

    private static String firstNonBlankText(JsonNode n, String... keys) {
        for (String k : keys) {
            JsonNode c = n.get(k);
            if (c != null && !c.isNull()) {
                if (c.isString()) {
                    String t = c.stringValue();
                    if (t != null && !t.isBlank()) {
                        return t;
                    }
                }
                if (c.isNumber()) {
                    return c.stringValue();
                }
            }
        }
        return null;
    }

    private static boolean isGarminLikelyRunning(String type) {
        if (type == null || type.isBlank()) {
            return true;
        }
        String u = type.toUpperCase(Locale.ROOT);
        if (u.contains("CYCLING") || u.contains("BIKE") || u.contains("SWIM") || u.contains("YOGA")) {
            return false;
        }
        return true;
    }

    private record GarminSyncStatusResponse(
            String status,
            int importedActivities,
            int skippedDuplicates,
            int skippedNonRuns,
            int processedCallbacks,
            String error,
            boolean active
    ) {
        static GarminSyncStatusResponse idle() {
            return new GarminSyncStatusResponse("IDLE", 0, 0, 0, 0, null, false);
        }
    }

    private static final class GarminSyncTracker {
        private String status = "IDLE";
        private int importedActivities;
        private int skippedDuplicates;
        private int skippedNonRuns;
        private int processedCallbacks;
        private String error;

        synchronized void markRunning() {
            importedActivities = 0;
            skippedDuplicates = 0;
            skippedNonRuns = 0;
            processedCallbacks = 0;
            error = null;
            status = "RUNNING";
        }

        synchronized void markCompleted() {
            status = "COMPLETED";
            error = null;
        }

        synchronized void markFailed(String message) {
            status = "FAILED";
            error = message;
        }

        synchronized void importResult(ImportResult r) {
            if (r == null) {
                return;
            }
            processedCallbacks++;
            importedActivities += r.importedActivities();
            skippedDuplicates += r.skippedDuplicates();
            skippedNonRuns += r.skippedNonRuns();
        }

        synchronized void incrementSkippedNonRuns() {
            skippedNonRuns++;
        }

        synchronized GarminSyncStatusResponse snapshot() {
            return new GarminSyncStatusResponse(
                    status,
                    importedActivities,
                    skippedDuplicates,
                    skippedNonRuns,
                    processedCallbacks,
                    error,
                    "RUNNING".equals(status)
            );
        }
    }
}
