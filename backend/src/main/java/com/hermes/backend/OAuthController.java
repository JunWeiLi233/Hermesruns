package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PreDestroy;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentMap;

@RestController
@RequestMapping("/api")
public class OAuthController {
    private static final int STRAVA_POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final SystemConfigService systemConfigService;
    private final AiUsageService aiUsageService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final AutomatedCoachService automatedCoachService;
    private final RestTemplate restTemplate;
    private final ConcurrentMap<Long, StravaSyncTracker> stravaSyncStates = new ConcurrentHashMap<>();
    private static final long STRAVA_LINK_REQUEST_TTL_MS = 10 * 60 * 1000L;

    // Bound background sync parallelism for small-RAM deployments.
    private final ExecutorService stravaBackgroundExecutor = Executors.newFixedThreadPool(
            2,
            r -> {
                Thread t = new Thread(r, "strava-sync-worker");
                t.setDaemon(true);
                return t;
            }
    );

    @Value("${google.client.id:}")
    private String googleClientId;

    @Value("${google.client.secret:}")
    private String googleClientSecret;

    @Value("${app.google.redirect-uri:http://localhost:8080/api/auth/google/callback}")
    private String googleRedirectUri;

    @Value("${strava.client.id:}")
    private String stravaClientId;

    @Value("${strava.client.secret:}")
    private String stravaClientSecret;

    @Value("${app.strava.redirect-uri:http://localhost:8080/api/auth/strava/callback}")
    private String stravaRedirectUri;

    /** Max Strava activity list pages per user when doing background / incremental sync (recent pages first). */
    @Value("${strava.sync.max-pages-recent:5}")
    private int stravaRecentSyncMaxPages;

    /** Max pages for a full history pull (login callback, manual resync). */
    @Value("${strava.sync.max-pages-full:50}")
    private int stravaFullSyncMaxPages;

    public OAuthController(RunnerRepository runnerRepository, AuthService authService,
                           ActivityRepository activityRepository, ActivityPointRepository activityPointRepository,
                           SecretEncryptionService secretEncryptionService, AiUsageService aiUsageService,
                           RestTemplate restTemplate,
                           SystemConfigService systemConfigService,
                           ApplicationEventPublisher applicationEventPublisher,
                           AutomatedCoachService automatedCoachService) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.aiUsageService = aiUsageService;
        this.restTemplate = restTemplate;
        this.systemConfigService = systemConfigService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.automatedCoachService = automatedCoachService;
    }

    @PreDestroy
    void shutdown() {
        stravaBackgroundExecutor.shutdownNow();
    }

    @GetMapping("/auth/providers")
    public ResponseEntity<Map<String, Boolean>> getAuthProviders() {
        Map<String, Boolean> response = new HashMap<>();
        response.put("googleConfigured", systemConfigService.isGoogleConfigured());
        response.put("stravaConfigured", systemConfigService.isStravaConfigured());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/auth/strava/status")
    public ResponseEntity<Map<String, Object>> getStravaStatus() {
        return ResponseEntity.ok(systemConfigService.getStravaStatus());
    }

    @GetMapping("/auth/google/start")
    public RedirectView startGoogleAuth(@RequestParam(required = false) String state) {
        if (!isGoogleConfigured()) {
            return errorRedirect("Google sign-in is not configured.", state);
        }

        String authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                + "?client_id=" + urlEncode(googleClientId)
                + "&redirect_uri=" + urlEncode(googleRedirectUri)
                + "&response_type=code"
                + "&scope=email%20profile";

        if (state != null && !state.isBlank()) {
            authUrl += "&state=" + urlEncode(state);
        }

        return new RedirectView(authUrl);
    }

    @GetMapping("/auth/strava/start")
    public RedirectView startStravaAuth(@RequestParam(required = false) String state) {
        if (!isStravaConfigured()) {
            return errorRedirect("Strava sign-in is not configured.", state);
        }
        return new RedirectView(buildStravaAuthUrl(state));
    }

    @PostMapping("/auth/strava/link-url")
    public ResponseEntity<?> createStravaLinkUrl(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid session"));
        }
        if (!isStravaConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Strava sign-in is not configured."));
        }

        return ResponseEntity.ok(Map.of(
                "url", buildStravaAuthUrl(createProfileLinkState(runnerOptional.get())),
                "expiresInSeconds", STRAVA_LINK_REQUEST_TTL_MS / 1000
        ));
    }

    @GetMapping("/auth/google/callback")
    public RedirectView handleGoogleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state
    ) {
        if (!isGoogleConfigured()) {
            return errorRedirect("Google sign-in is not configured.", state);
        }

        if (code == null || code.isBlank()) {
            return errorRedirect("Google sign-in failed.", state);
        }

        RestTemplate restTemplate = this.restTemplate;

        try {
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
            tokenParams.add("client_id", googleClientId);
            tokenParams.add("client_secret", googleClientSecret);
            tokenParams.add("code", code);
            tokenParams.add("grant_type", "authorization_code");
            tokenParams.add("redirect_uri", googleRedirectUri);

            ResponseEntity<Map<String, Object>> tokenResponse = restTemplate.exchange(
                    "https://oauth2.googleapis.com/token",
                    HttpMethod.POST,
                    new HttpEntity<>(tokenParams, tokenHeaders),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            );

            Map<String, Object> tokenBody = tokenResponse.getBody();
            String accessToken = tokenBody == null ? null : stringValue(tokenBody.get("access_token"));
            if (accessToken == null || accessToken.isBlank()) {
                return errorRedirect("Google sign-in failed.", state);
            }

            HttpHeaders userInfoHeaders = new HttpHeaders();
            userInfoHeaders.setBearerAuth(accessToken);

            ResponseEntity<Map<String, Object>> infoResponse = restTemplate.exchange(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    HttpMethod.GET,
                    new HttpEntity<>(userInfoHeaders),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            );

            Map<String, Object> infoBody = infoResponse.getBody();
            String googleEmail = authService.normalizeEmail(infoBody == null ? null : stringValue(infoBody.get("email")));
            if (googleEmail == null || googleEmail.isBlank()) {
                return errorRedirect("Google sign-in failed.", state);
            }

            Runner runner = runnerRepository.findByEmailIgnoreCase(googleEmail)
                    .filter(existingRunner -> !existingRunner.isDeleted())
                    .orElseGet(() -> {
                        Runner newRunner = new Runner();
                        newRunner.setEmail(googleEmail);
                        newRunner.setRole("USER");
                        newRunner.setStatus("ACTIVE_GOOGLE");
                        aiUsageService.initNewUser(newRunner);
                        return runnerRepository.save(newRunner);
                    });
            runner.setEmailVerified(true);

            String token = authService.issueSessionToken(runner);
            String targetPage = authService.isAdmin(runner) ? "/dashboard" : "/profile";

            return new RedirectView(
                    targetPage
                            + "#source=google"
                            + "&token=" + urlEncode(token)
                            + "&email=" + urlEncode(runner.getEmail())
            );
        } catch (Exception exception) {
            return errorRedirect("Google sign-in failed.", state);
        }
    }

    @GetMapping("/auth/strava/callback")
    public RedirectView handleStravaCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String state
    ) {
        if (!isStravaConfigured()) {
            System.err.println("[Hermes] Strava OAuth callback hit but Strava is not configured.");
            return errorRedirectCode(
                    "STRAVA_NOT_CONFIGURED",
                    "Strava OAuth is not configured on this server.",
                    state
            );
        }

        if (error != null && !error.isBlank()) {
            System.err.println("[Hermes] Strava OAuth callback returned error: " + error);
            return errorRedirectCode(
                    "STRAVA_OAUTH_ERROR",
                    "Strava returned an error.",
                    state
            );
        }

        if (code == null || code.isBlank()) {
            System.err.println("[Hermes] Strava OAuth callback missing authorization code.");
            return errorRedirectCode(
                    "STRAVA_MISSING_CODE",
                    "Strava callback is missing the authorization code.",
                    state
            );
        }

        RestTemplate restTemplate = this.restTemplate;

        try {
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
            tokenParams.add("client_id", stravaClientId);
            tokenParams.add("client_secret", stravaClientSecret);
            tokenParams.add("code", code);
            // Some OAuth providers require the same redirect_uri on token exchange.
            tokenParams.add("redirect_uri", stravaRedirectUri);
            tokenParams.add("grant_type", "authorization_code");

            ResponseEntity<Map<String, Object>> tokenResponse = restTemplate.exchange(
                    "https://www.strava.com/oauth/token",
                    HttpMethod.POST,
                    new HttpEntity<>(tokenParams, tokenHeaders),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }
            );

            Map<String, Object> responseBody = tokenResponse.getBody();
            if (responseBody == null) {
                return errorRedirectCode(
                        "STRAVA_OAUTH_INVALID_RESPONSE",
                        "Strava token response was empty/invalid.",
                        state
                );
            }

            String accessToken = stringValue(responseBody.get("access_token"));
            String refreshToken = stringValue(responseBody.get("refresh_token"));
            Long expiresAt = longValue(responseBody.get("expires_at"));
            Map<String, Object> athlete = mapValue(responseBody.get("athlete"));
            Long athleteId = longValue(athlete.get("id"));

            if (accessToken == null || accessToken.isBlank() || athleteId == null) {
                return errorRedirectCode(
                        "STRAVA_OAUTH_INVALID_RESPONSE",
                        "Strava token response missing access_token/athlete id.",
                        state
                );
            }

            Optional<PendingStravaLinkRequest> pendingLinkRequest = decodeProfileLinkState(state);
            Optional<Runner> linkedRunner = runnerRepository.findByStravaAthleteId(athleteId)
                    .filter(existingRunner -> !existingRunner.isDeleted());
            Optional<Runner> legacyShadowRunner = runnerRepository.findByEmailIgnoreCase(stravaEmail(athleteId))
                    .filter(existingRunner -> !existingRunner.isDeleted());
            if (pendingLinkRequest.isPresent()) {
                return completeAuthenticatedStravaLink(
                        pendingLinkRequest.get(),
                        linkedRunner,
                        legacyShadowRunner,
                        athlete,
                        athleteId,
                        accessToken,
                        refreshToken,
                        expiresAt
                );
            }
            if (linkedRunner.isEmpty() && legacyShadowRunner.isEmpty()) {
                return stravaLinkConfirmationRedirect(state, athleteId, athlete);
            }

            Runner runner = linkedRunner.orElseGet(legacyShadowRunner::get);

            if (runner.getEmail() == null || runner.getEmail().isBlank()) {
                runner.setEmail(stravaEmail(athleteId));
            }

            if (runner.getRole() == null || runner.getRole().isBlank()) {
                runner.setRole("USER");
            }

            runner.setDeleted(false);
            runner.setStatus("ACTIVE_STRAVA");
            runner.setStravaAthleteId(athleteId);
            runner.setStravaUsername(stringValue(athlete.get("username")));
            runner.setStravaAccessToken(secretEncryptionService.encrypt(accessToken));
            runner.setStravaRefreshToken(secretEncryptionService.encrypt(refreshToken));
            runner.setStravaTokenExpiresAt(expiresAt);

            if (runner.getDisplayName() == null || runner.getDisplayName().isBlank()) {
                runner.setDisplayName(resolveStravaDisplayName(athlete, athleteId));
            }

            runner.setEmailVerified(true);

            if (runner.getId() == null) {
                aiUsageService.initNewUser(runner);
            }

            runner = runnerRepository.save(runner);

            Long runnerId = runner.getId();
            CompletableFuture.runAsync(
                    () -> fetchAndSaveStravaActivities(accessToken, runnerId, false),
                    stravaBackgroundExecutor
            );

            String token = authService.issueSessionToken(runner);
            String targetPage = authService.isAdmin(runner) ? "/dashboard" : "/profile";

            return new RedirectView(
                    targetPage
                            + "#source=strava"
                            + "&token=" + urlEncode(token)
                            + "&email=" + urlEncode(runner.getEmail())
            );
        } catch (Exception exception) {
            System.err.println("[Hermes] Strava OAuth callback failed: "
                    + exception.getClass().getSimpleName() + " - " + exception.getMessage());
            return errorRedirectCode(
                    "STRAVA_OAUTH_FAILED",
                    exception.getClass().getSimpleName() + ": " + safeMessage(exception),
                    state
            );
        }
    }

    @GetMapping("/strava/sync")
    public ResponseEntity<?> reSyncStrava(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {

        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid session");
        }

        Runner runner = runnerOpt.get();
        String accessToken;
        try {
            accessToken = resolveRunnerStravaAccessToken(runner);
        } catch (Exception ex) {
            // Token/cipher mismatch should not bubble up as 500 in client-triggered sync.
            System.err.println("Strava sync skipped for runner " + runner.getId() + ": " + ex.getMessage());
            return ResponseEntity.ok("Strava token is invalid; please relink your Strava account.");
        }
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.ok("No Strava account linked");
        }

        CompletableFuture.runAsync(
                () -> fetchAndSaveStravaActivities(accessToken, runner.getId(), false),
                stravaBackgroundExecutor
        );
        return ResponseEntity.ok("Strava sync started");
    }

    @GetMapping("/auth/strava/sync-status")
    public ResponseEntity<?> getStravaSyncStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Invalid or expired session token.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        }

        Runner runner = runnerOptional.get();
        StravaSyncTracker tracker = stravaSyncStates.get(runner.getId());
        if (tracker == null) {
            return ResponseEntity.ok(StravaSyncStatusResponse.idle());
        }

        return ResponseEntity.ok(tracker.snapshot());
    }

    @GetMapping("/auth/protected/ping")
    public ResponseEntity<?> verifySession(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Invalid or expired session token.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        }

        Runner runner = runnerOptional.get();
        Map<String, String> response = new HashMap<>();
        response.put("email", runner.getEmail());
        response.put("role", runner.getRole());
        response.put("status", runner.getStatus());
        return ResponseEntity.ok(response);
    }

    /**
     * Pull activities from Strava into Hermes.
     *
     * @param recentOnly when true (scheduled / incremental jobs), only fetch the first {@link #stravaRecentSyncMaxPages}
     *                   pages and stop early once a page contains runs that are already stored (Strava lists newest first).
     */
    void fetchAndSaveStravaActivities(String accessToken, Long runnerId, boolean recentOnly) {
        StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runnerId, ignored -> new StravaSyncTracker());
        if (!tracker.tryBeginSync()) {
            return;
        }

        Optional<Runner> runnerOptional = runnerRepository.findById(runnerId);
        if (runnerOptional.isEmpty()) {
            tracker.markFailed("Runner account could not be found for Strava sync.");
            return;
        }

        Runner runner = runnerOptional.get();
        RestTemplate restTemplate = this.restTemplate;
        HttpHeaders headers = new HttpHeaders();
        String currentAccessToken = accessToken;
        headers.setBearerAuth(currentAccessToken);

        int page = 1;
        final int maxPages = recentOnly ? Math.max(1, stravaRecentSyncMaxPages) : Math.max(1, stravaFullSyncMaxPages);
        boolean[] gpsRateLimited = {false};
        try {
            while (page <= maxPages) {
                String activitiesUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=" + page;
                ResponseEntity<List<Map<String, Object>>> response;
                try {
                    response = restTemplate.exchange(
                            activitiesUrl,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {
                            }
                    );
                } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized unauthorized) {
                    // Async syncs can start with an access token that expires before the request is sent.
                    // Re-resolve the runner token once and retry the same page.
                    Runner freshRunner = runnerRepository.findById(runnerId).orElse(runner);
                    String refreshedAccessToken;
                    try {
                        refreshedAccessToken = resolveRunnerStravaAccessToken(freshRunner);
                    } catch (Exception tokenException) {
                        tracker.markFailed("Stored Strava token is invalid; please relink Strava.");
                        return;
                    }

                    if (refreshedAccessToken == null || refreshedAccessToken.isBlank()
                            || Objects.equals(refreshedAccessToken, currentAccessToken)) {
                        throw unauthorized;
                    }

                    runner = freshRunner;
                    currentAccessToken = refreshedAccessToken;
                    headers.setBearerAuth(currentAccessToken);
                    response = restTemplate.exchange(
                            activitiesUrl,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {
                            }
                    );
                }

                List<Map<String, Object>> activities = response.getBody();
                if (activities == null || activities.isEmpty()) {
                    tracker.markCompleted();
                    return;
                }

                tracker.incrementProcessedPages();
                int runsOnPage = 0;
                int newOrUpdatedRunsOnPage = 0;
                for (Map<String, Object> activityData : activities) {
                    StravaActivitySyncResult r = syncSingleStravaActivity(
                            runner, tracker, activityData, gpsRateLimited, restTemplate, headers, currentAccessToken);
                    if (r == StravaActivitySyncResult.SKIPPED_NON_RUN) {
                        continue;
                    }
                    runsOnPage++;
                    if (r == StravaActivitySyncResult.NEW_OR_UPDATED_RUN) {
                        newOrUpdatedRunsOnPage++;
                    }
                }

                // Newest-first listing: once a page has runs but none were new/updated, older pages are duplicates.
                if (runsOnPage > 0 && newOrUpdatedRunsOnPage == 0) {
                    tracker.markCompleted();
                    return;
                }

                page++;
            }
            tracker.markCompleted();
        } catch (Exception exception) {
            tracker.markFailed("Unable to sync Strava activities right now.");
        }
    }

    private enum StravaActivitySyncResult {
        SKIPPED_NON_RUN,
        NEW_OR_UPDATED_RUN,
        DUPLICATE_RUN
    }

    private StravaActivitySyncResult syncSingleStravaActivity(Runner runner, StravaSyncTracker tracker, Map<String, Object> activityData,
                                          boolean[] gpsRateLimited, RestTemplate restTemplate, HttpHeaders headers,
                                          String accessToken) {
        ActivityType activityType = ActivityTypeResolver.fromSportLabels(
                stringValue(activityData.get("sport_type")),
                stringValue(activityData.get("type")),
                stringValue(activityData.get("name"))
        );

        if (activityType != ActivityType.RUN) {
            tracker.incrementSkippedNonRuns();
            return StravaActivitySyncResult.SKIPPED_NON_RUN;
        }

        String stravaId = stringValue(activityData.get("id"));
        if (stravaId == null || stravaId.isBlank()) {
            tracker.incrementSkippedNonRuns();
            return StravaActivitySyncResult.SKIPPED_NON_RUN;
        }

        String checksum = "STRAVA_" + stravaId;
        Activity activity = activityRepository
                .findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, checksum)
                .orElseGet(Activity::new);

        boolean existingActivity = activity.getId() != null;
        ActivityType previousType = activity.getActivityType();

        if (!existingActivity) {
            activity.setRunner(runner);
            activity.setProvider(ImportProvider.STRAVA);
            activity.setSourceChecksum(checksum);
            activity.setCreatedAt(LocalDateTime.now());
        }

        String activityName = resolveStravaActivityName(activityData, stravaId);
        Double distanceMetersVal = doubleValue(activityData.get("distance"));
        double distanceMeters = distanceMetersVal != null ? distanceMetersVal : 0d;
        Long movingTimeVal = longValue(activityData.get("moving_time"));
        long movingTimeSeconds = movingTimeVal != null ? movingTimeVal : 0L;
        String startDate = stringValue(activityData.get("start_date_local"));

        activity.setActivityType(ActivityType.RUN);
        activity.setStravaId(stravaId);
        activity.setName(activityName);
        activity.setDistanceMeters(distanceMeters > 0d ? distanceMeters : null);
        activity.setDistanceKm(distanceMeters > 0d ? distanceMeters / 1000d : 0d);
        activity.setDurationSeconds(movingTimeSeconds > 0L ? movingTimeSeconds : null);
        activity.setMovingTimeSeconds((int) movingTimeSeconds);
        activity.setStartDate(startDate);
        activity.setStartTime(parseDateTime(startDate));

        // Performance metrics
        activity.setAverageHeartRate(doubleValue(activityData.get("average_heartrate")));
        activity.setMaxHeartRate(doubleValue(activityData.get("max_heartrate")));
        activity.setTotalElevationGain(doubleValue(activityData.get("total_elevation_gain")));
        activity.setCalories(intValue(activityData.get("calories")));
        Double cadence = doubleValue(activityData.get("average_cadence"));
        activity.setAverageCadence(cadence != null ? cadence * 2 : null);
        activity.setAverageWatts(doubleValue(activityData.get("average_watts")));
        activity.setMaxSpeedMps(doubleValue(activityData.get("max_speed")));
        activity.setSufferScore(intValue(activityData.get("suffer_score")));

        Activity saved = activityRepository.save(activity);

        // Fetch GPS stream only if not already cached and not rate-limited
        if (!gpsRateLimited[0] && !activityPointRepository.existsByActivity(saved)) {
            gpsRateLimited[0] = !fetchAndSaveGpsStream(saved, stravaId, accessToken, restTemplate, headers);
        }

        if (existingActivity && previousType == ActivityType.RUN) {
            tracker.incrementSkippedDuplicates();
            return StravaActivitySyncResult.DUPLICATE_RUN;
        }
        tracker.incrementImportedRuns();
        return StravaActivitySyncResult.NEW_OR_UPDATED_RUN;
    }

    @SuppressWarnings("unchecked")
    private boolean fetchAndSaveGpsStream(Activity activity, String stravaId, String accessToken,
                                          RestTemplate restTemplate, HttpHeaders headers) {
        try {
            String url = "https://www.strava.com/api/v3/activities/" + stravaId
                    + "/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            List<Map<String, Object>> streams = response.getBody();
            if (streams == null) return true;
            List<List<Double>> latlng = null;
            List<Number> time = null;
            List<Number> distance = null;
            List<Number> altitude = null;
            List<Number> heartRate = null;
            List<Number> cadence = null;
            for (Map<String, Object> stream : streams) {
                if (!stream.containsKey("type")) continue;
                String type = String.valueOf(stream.get("type"));
                Object dataObj = stream.get("data");
                if ("latlng".equals(type) && dataObj instanceof List<?> l) latlng = (List<List<Double>>) l;
                if ("time".equals(type) && dataObj instanceof List<?> l) time = (List<Number>) l;
                if ("distance".equals(type) && dataObj instanceof List<?> l) distance = (List<Number>) l;
                if ("altitude".equals(type) && dataObj instanceof List<?> l) altitude = (List<Number>) l;
                if ("heartrate".equals(type) && dataObj instanceof List<?> l) heartRate = (List<Number>) l;
                if ("cadence".equals(type) && dataObj instanceof List<?> l) cadence = (List<Number>) l;
            }
            if (latlng == null || latlng.isEmpty()) return true;

            // Memory optimization for small RAM servers:
            // avoid building the full points list; save incrementally.
            final int batchSize = STRAVA_POINTS_BATCH_SIZE;
            int total = latlng.size();
            int stride = total > MAX_POINTS_PER_ACTIVITY
                    ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                    : 1;

            List<ActivityPoint> batch = new ArrayList<>(batchSize);
            int totalSaved = 0;
            int seq = 0;

            for (int i = 0; i < total; i += stride) {
                List<Double> coord = latlng.get(i);
                if (coord == null || coord.size() < 2) continue;

                ActivityPoint point = new ActivityPoint();
                point.setActivity(activity);
                point.setLatitude(coord.get(0));
                point.setLongitude(coord.get(1));
                point.setSequenceIndex(seq++);
                point.setElapsedSeconds(numberAt(time, i) == null ? null : numberAt(time, i).intValue());
                point.setDistanceMeters(numberAt(distance, i) == null ? null : numberAt(distance, i).doubleValue());
                point.setElevationMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
                point.setElevationRawMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
                point.setHeartRate(numberAt(heartRate, i) == null ? null : numberAt(heartRate, i).intValue());
                Number cad = numberAt(cadence, i);
                point.setCadence(cad == null ? null : (int) Math.round(cad.doubleValue() * 2.0));
                batch.add(point);

                if (batch.size() >= batchSize) {
                    activityPointRepository.saveAll(batch);
                    activityPointRepository.flush();
                    totalSaved += batch.size();
                    batch.clear();
                }
            }

            if (!batch.isEmpty()) {
                activityPointRepository.saveAll(batch);
                activityPointRepository.flush();
                totalSaved += batch.size();
            }

            System.out.println("GPS cached: " + stravaId + " (" + totalSaved + " pts)");
            return true;

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (e.getStatusCode().value() == 429) {
                System.err.println("GPS rate limited — remaining GPS will sync on first run view");
                return false;
            }
            System.err.println("GPS fetch skipped for " + stravaId + ": " + e.getMessage());
            return true;
        } catch (Exception e) {
            System.err.println("GPS fetch skipped for " + stravaId + ": " + e.getMessage());
            return true;
        }
    }

    private static Number numberAt(List<Number> list, int i) {
        if (list == null || i < 0 || i >= list.size()) return null;
        return list.get(i);
    }

    /**
     * Fetch and sync a single Strava activity by its ID (used by webhook handler).
     */
    void syncStravaActivityById(Runner runner, long stravaActivityId) {
        String accessToken = resolveRunnerStravaAccessToken(runner);
        if (accessToken == null || accessToken.isBlank()) return;

        try {
            RestTemplate restTemplate = this.restTemplate;
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);

            String url = "https://www.strava.com/api/v3/activities/" + stravaActivityId;
            @SuppressWarnings("unchecked")
            Map<String, Object> activityData = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();

            if (activityData == null) return;

            StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runner.getId(), ignored -> new StravaSyncTracker());
            boolean[] gpsRateLimited = {false};
            syncSingleStravaActivity(runner, tracker, activityData, gpsRateLimited, restTemplate, headers, accessToken);
        } catch (Exception e) {
            System.err.println("Strava webhook sync failed for activity " + stravaActivityId + ": " + e.getMessage());
        }
    }

    /** Delete a Strava activity that was removed on Strava (webhook delete event). */
    void deleteStravaActivity(Runner runner, long stravaActivityId) {
        String checksum = "STRAVA_" + stravaActivityId;
        activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, checksum)
                .ifPresent(activity -> {
                    activityPointRepository.deleteByActivity(activity);
                    activityRepository.delete(activity);
                    automatedCoachService.reaggregateRunner(runner.getId());
                });
    }

    private boolean isGoogleConfigured() {
        return systemConfigService.isGoogleConfigured();
    }

    boolean isStravaConfigured() {
        return systemConfigService.isStravaConfigured();
    }

    String resolveRunnerStravaAccessToken(Runner runner) {
        String storedAccessToken = runner.getStravaAccessToken();
        if (storedAccessToken == null || storedAccessToken.isBlank()) {
            return null;
        }

        String decryptedAccessToken = secretEncryptionService.decrypt(storedAccessToken);
        String storedRefreshToken = runner.getStravaRefreshToken();
        String decryptedRefreshToken = secretEncryptionService.decrypt(storedRefreshToken);

        // Migrate unencrypted tokens
        if (secretEncryptionService.isConfigured()
                && (!secretEncryptionService.isEncrypted(storedAccessToken)
                || (storedRefreshToken != null && !storedRefreshToken.isBlank() && !secretEncryptionService.isEncrypted(storedRefreshToken)))) {
            runner.setStravaAccessToken(secretEncryptionService.encrypt(decryptedAccessToken));
            runner.setStravaRefreshToken(secretEncryptionService.encrypt(decryptedRefreshToken));
            runnerRepository.save(runner);
        }

        // Auto-refresh if token is expired or about to expire (within 5 minutes)
        Long expiresAt = runner.getStravaTokenExpiresAt();
        if (expiresAt != null && expiresAt < (System.currentTimeMillis() / 1000) + 300) {
            String refreshed = refreshStravaToken(runner, decryptedRefreshToken);
            if (refreshed != null) return refreshed;
        }

        return decryptedAccessToken;
    }

    private String refreshStravaToken(Runner runner, String refreshToken) {
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
            System.err.println("Strava token refresh failed for runner " + runner.getId() + ": " + e.getMessage());
        }
        return null;
    }

    private RedirectView errorRedirect(String message, String state) {
        return new RedirectView(resolveEntryPage(state) + "?error=" + urlEncode(message));
    }

    private RedirectView errorRedirectCode(String code, String details, String state) {
        String base = resolveEntryPage(state) + "?error=" + urlEncode(code);
        if (details != null && !details.isBlank()) {
            base += "&details=" + urlEncode(details);
        }
        return new RedirectView(base);
    }

    @Transactional
    RedirectView completeAuthenticatedStravaLink(
            PendingStravaLinkRequest pendingLinkRequest,
            Optional<Runner> linkedRunner,
            Optional<Runner> legacyShadowRunner,
            Map<String, Object> athlete,
            Long athleteId,
            String accessToken,
            String refreshToken,
            Long expiresAt
    ) {
        Optional<Runner> runnerOptional = runnerRepository.findById(pendingLinkRequest.runnerId())
                .filter(existingRunner -> !existingRunner.isDeleted());
        if (runnerOptional.isEmpty()) {
            return errorRedirectCode(
                    "STRAVA_LINK_SESSION_EXPIRED",
                    "Your Strava linking session expired. Please start from your Hermes profile again.",
                    "profile-link"
            );
        }

        Runner currentRunner = runnerOptional.get();
        if (!Objects.equals(currentRunner.getSessionToken(), pendingLinkRequest.sessionFingerprint())) {
            return errorRedirectCode(
                    "STRAVA_LINK_SESSION_EXPIRED",
                    "Your Strava linking session expired. Please start from your Hermes profile again.",
                    "profile-link"
            );
        }
        if (linkedRunner.isPresent() && !Objects.equals(linkedRunner.get().getId(), currentRunner.getId())) {
            return errorRedirectCode(
                    "STRAVA_LINK_CONFLICT",
                    "This Strava account is already linked to another Hermes runner.",
                    "profile-link"
            );
        }

        if (legacyShadowRunner.isPresent() && !Objects.equals(legacyShadowRunner.get().getId(), currentRunner.getId())) {
            mergeLegacyShadowRunnerIntoCurrent(currentRunner, legacyShadowRunner.get());
        }

        if (currentRunner.getRole() == null || currentRunner.getRole().isBlank()) {
            currentRunner.setRole("USER");
        }
        if (currentRunner.getDisplayName() == null || currentRunner.getDisplayName().isBlank()) {
            currentRunner.setDisplayName(resolveStravaDisplayName(athlete, athleteId));
        }
        currentRunner.setDeleted(false);
        currentRunner.setStatus("ACTIVE_STRAVA");
        currentRunner.setStravaAthleteId(athleteId);
        currentRunner.setStravaUsername(stringValue(athlete.get("username")));
        currentRunner.setStravaAccessToken(secretEncryptionService.encrypt(accessToken));
        currentRunner.setStravaRefreshToken(secretEncryptionService.encrypt(refreshToken));
        currentRunner.setStravaTokenExpiresAt(expiresAt);
        currentRunner.setEmailVerified(true);
        runnerRepository.save(currentRunner);

        CompletableFuture.runAsync(
                () -> fetchAndSaveStravaActivities(accessToken, currentRunner.getId(), false),
                stravaBackgroundExecutor
        );

        return new RedirectView("/profile?linking=linked");
    }

    @Transactional
    void mergeLegacyShadowRunnerIntoCurrent(Runner currentRunner, Runner shadowRunner) {
        if (currentRunner.getDisplayName() == null || currentRunner.getDisplayName().isBlank()) {
            currentRunner.setDisplayName(shadowRunner.getDisplayName());
        }

        List<Activity> shadowActivities = activityRepository.findByRunnerOrderByIdDesc(shadowRunner);
        for (Activity activity : shadowActivities) {
            activity.setRunner(currentRunner);
        }
        if (!shadowActivities.isEmpty()) {
            activityRepository.saveAll(shadowActivities);
        }

        shadowRunner.setDeleted(true);
        shadowRunner.setSessionToken(null);
        shadowRunner.setStravaAthleteId(null);
        shadowRunner.setStravaUsername(null);
        shadowRunner.setStravaAccessToken(null);
        shadowRunner.setStravaRefreshToken(null);
        shadowRunner.setStravaTokenExpiresAt(null);
        runnerRepository.save(shadowRunner);
    }

    private RedirectView stravaLinkConfirmationRedirect(String state, Long athleteId, Map<String, Object> athlete) {
        String base = resolveEntryPage(state)
                + "?error=" + urlEncode("STRAVA_LINK_CONFIRMATION_REQUIRED")
                + "&source=strava"
                + "&linking=confirmation_required";
        String details = "Hermes found your Strava athlete but needs manual confirmation before linking it to a Hermes account.";
        String athleteLabel = resolveStravaDisplayName(athlete, athleteId);
        if (athleteLabel != null && !athleteLabel.isBlank()) {
            details += " Athlete: " + athleteLabel + ".";
        }
        if (athleteId != null) {
            details += " Strava athlete id: " + athleteId + ".";
        }
        return new RedirectView(base + "&details=" + urlEncode(details));
    }

    private String safeMessage(Exception exception) {
        try {
            String msg = exception.getMessage();
            if (msg == null) return "";
            // Keep the URL reasonably short; avoid dumping huge nested messages.
            msg = msg.trim();
            return msg.length() > 200 ? msg.substring(0, 200) : msg;
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveEntryPage(String state) {
        if (isProfileLinkState(state)) {
            return "/profile";
        }
        return Objects.equals(state, "signup") ? "/signup" : "/login";
    }

    private String buildStravaAuthUrl(String state) {
        String authUrl = "https://www.strava.com/oauth/authorize"
                + "?client_id=" + urlEncode(stravaClientId)
                + "&redirect_uri=" + urlEncode(stravaRedirectUri)
                + "&response_type=code"
                + "&approval_prompt=auto"
                + "&scope=" + urlEncode("read,activity:read_all");

        if (state != null && !state.isBlank()) {
            authUrl += "&state=" + urlEncode(state);
        }
        return authUrl;
    }

    private Optional<PendingStravaLinkRequest> decodeProfileLinkState(String state) {
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
            payload = new String(java.util.Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }

        String expectedSignature = signProfileLinkPayload(payload);
        if (!MessageDigest.isEqual(
                expectedSignature.getBytes(StandardCharsets.UTF_8),
                parts[1].getBytes(StandardCharsets.UTF_8)
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

    private boolean isProfileLinkState(String state) {
        return state != null && state.startsWith("profile-link:");
    }

    private String createProfileLinkState(Runner runner) {
        long expiresAtMs = System.currentTimeMillis() + STRAVA_LINK_REQUEST_TTL_MS;
        String payload = runner.getId() + ":" + expiresAtMs + ":" + blankToEmpty(runner.getSessionToken());
        String encodedPayload = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return "profile-link:" + encodedPayload + "." + signProfileLinkPayload(payload);
    }

    private String signProfileLinkPayload(String payload) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] signature = digest.digest((payload + ":" + stravaClientSecret).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(signature);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private String stravaEmail(Long athleteId) {
        return "strava+" + athleteId + "@hermes.local";
    }

    private String resolveStravaDisplayName(Map<String, Object> athlete, Long athleteId) {
        String firstName = stringValue(athlete.get("firstname"));
        String lastName = stringValue(athlete.get("lastname"));
        String username = stringValue(athlete.get("username"));
        String fullName = String.join(" ", blankToEmpty(firstName), blankToEmpty(lastName)).trim();

        if (!fullName.isBlank()) {
            return fullName;
        }

        if (username != null && !username.isBlank()) {
            return username;
        }

        return "Strava Runner " + athleteId;
    }

    private String resolveStravaActivityName(Map<String, Object> activityData, String stravaId) {
        String explicitName = stringValue(activityData.get("name"));
        if (explicitName != null && !explicitName.isBlank()) {
            return explicitName;
        }
        return "Strava Run " + stravaId;
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(value.trim()).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(value.trim());
            } catch (Exception secondIgnored) {
                return null;
            }
        }
    }

    private String blankToEmpty(String value) {
        return value == null ? "" : value;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return new HashMap<>();
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long longValue(Object value) {
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

    private Double doubleValue(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Double.parseDouble(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private Integer intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Integer.parseInt(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record StravaSyncStatusResponse(
            String status,
            int importedRuns,
            int skippedNonRuns,
            int skippedDuplicates,
            int processedActivities,
            int processedPages,
            String error,
            boolean active
    ) {
        static StravaSyncStatusResponse idle() {
            return new StravaSyncStatusResponse("IDLE", 0, 0, 0, 0, 0, null, false);
        }
    }

    private static final class StravaSyncTracker {
        private String status = "IDLE";
        private int importedRuns;
        private int skippedNonRuns;
        private int skippedDuplicates;
        private int processedActivities;
        private int processedPages;
        private String error;
        private long lastUpdatedMs = System.currentTimeMillis();

        synchronized void resetForNewSync() {
            status = "PENDING";
            importedRuns = 0;
            skippedNonRuns = 0;
            skippedDuplicates = 0;
            processedActivities = 0;
            processedPages = 0;
            error = null;
        }

        /**
         * @return false if a sync is already in progress for this runner (avoids overlapping Strava API pulls).
         */
        synchronized boolean tryBeginSync() {
            if ("RUNNING".equals(status) || "PENDING".equals(status)) {
                return false;
            }
            resetForNewSync();
            status = "RUNNING";
            return true;
        }

        synchronized void incrementImportedRuns() {
            importedRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedNonRuns() {
            skippedNonRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedDuplicates() {
            skippedDuplicates++;
            processedActivities++;
        }

        synchronized void incrementProcessedPages() {
            processedPages++;
        }

        synchronized void markCompleted() {
            status = "COMPLETED";
            error = null;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markFailed(String message) {
            status = "FAILED";
            error = message;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean isStale(long cutoffMs) {
            return lastUpdatedMs < cutoffMs && !"RUNNING".equals(status) && !"PENDING".equals(status);
        }

        synchronized StravaSyncStatusResponse snapshot() {
            return new StravaSyncStatusResponse(
                    status,
                    importedRuns,
                    skippedNonRuns,
                    skippedDuplicates,
                    processedActivities,
                    processedPages,
                    error,
                    "RUNNING".equals(status) || "PENDING".equals(status)
            );
        }
    }

    /** Save activity points in batches of 500 to limit memory pressure */
    private void savePointsInBatches(List<ActivityPoint> points) {
        final int batchSize = 500;
        for (int i = 0; i < points.size(); i += batchSize) {
            activityPointRepository.saveAll(points.subList(i, Math.min(i + batchSize, points.size())));
            activityPointRepository.flush();
        }
    }

    /** Remove completed/failed sync trackers older than 30 minutes (runs every 10 minutes) */
    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000)
    void cleanupStaleSyncTrackers() {
        long cutoff = System.currentTimeMillis() - 1_800_000; // 30 minutes
        stravaSyncStates.entrySet().removeIf(entry -> entry.getValue().isStale(cutoff));
    }

    private record PendingStravaLinkRequest(Long runnerId, long expiresAtMs, String sessionFingerprint) {}
}
