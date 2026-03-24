package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@RestController
@RequestMapping("/api")
public class OAuthController {
    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final GarminOAuthSettings garminOAuthSettings;
    private final ConcurrentMap<Long, StravaSyncTracker> stravaSyncStates = new ConcurrentHashMap<>();

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

    public OAuthController(RunnerRepository runnerRepository, AuthService authService,
                           ActivityRepository activityRepository, ActivityPointRepository activityPointRepository,
                           SecretEncryptionService secretEncryptionService,
                           GarminOAuthSettings garminOAuthSettings) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.garminOAuthSettings = garminOAuthSettings;
    }

    @GetMapping("/auth/providers")
    public ResponseEntity<Map<String, Boolean>> getAuthProviders() {
        Map<String, Boolean> response = new HashMap<>();
        response.put("googleConfigured", isGoogleConfigured());
        response.put("stravaConfigured", isStravaConfigured());
        response.put("garminGlobalConfigured", garminOAuthSettings.isGlobalConsumerPairConfigured());
        return ResponseEntity.ok(response);
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

        String authUrl = "https://www.strava.com/oauth/authorize"
                + "?client_id=" + urlEncode(stravaClientId)
                + "&redirect_uri=" + urlEncode(stravaRedirectUri)
                + "&response_type=code"
                + "&approval_prompt=auto"
                + "&scope=" + urlEncode("read,activity:read_all");

        if (state != null && !state.isBlank()) {
            authUrl += "&state=" + urlEncode(state);
        }

        return new RedirectView(authUrl);
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

        RestTemplate restTemplate = new RestTemplate();

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
                        return runnerRepository.save(newRunner);
                    });

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
            return errorRedirect("Strava sign-in is not configured.", state);
        }

        if (error != null && !error.isBlank()) {
            return errorRedirect("Strava sign-in failed.", state);
        }

        if (code == null || code.isBlank()) {
            return errorRedirect("Strava sign-in failed.", state);
        }

        RestTemplate restTemplate = new RestTemplate();

        try {
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
            tokenParams.add("client_id", stravaClientId);
            tokenParams.add("client_secret", stravaClientSecret);
            tokenParams.add("code", code);
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
                return errorRedirect("Strava sign-in failed.", state);
            }

            String accessToken = stringValue(responseBody.get("access_token"));
            String refreshToken = stringValue(responseBody.get("refresh_token"));
            Long expiresAt = longValue(responseBody.get("expires_at"));
            Map<String, Object> athlete = mapValue(responseBody.get("athlete"));
            Long athleteId = longValue(athlete.get("id"));

            if (accessToken == null || accessToken.isBlank() || athleteId == null) {
                return errorRedirect("Strava sign-in failed.", state);
            }

            Runner runner = runnerRepository.findByStravaAthleteId(athleteId)
                    .filter(existingRunner -> !existingRunner.isDeleted())
                    .orElseGet(() -> runnerRepository.findByEmailIgnoreCase(stravaEmail(athleteId))
                            .filter(existingRunner -> !existingRunner.isDeleted())
                            .orElseGet(Runner::new));

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

            runner = runnerRepository.save(runner);

            StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runner.getId(), ignored -> new StravaSyncTracker());
            tracker.resetForNewSync();

            Long runnerId = runner.getId();
            CompletableFuture.runAsync(() -> fetchAndSaveStravaActivities(accessToken, runnerId));

            String token = authService.issueSessionToken(runner);
            String targetPage = authService.isAdmin(runner) ? "/dashboard" : "/profile";

            return new RedirectView(
                    targetPage
                            + "#source=strava"
                            + "&token=" + urlEncode(token)
                            + "&email=" + urlEncode(runner.getEmail())
            );
        } catch (Exception exception) {
            return errorRedirect("Strava sign-in failed.", state);
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
        String accessToken = resolveRunnerStravaAccessToken(runner);
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("No Strava account linked");
        }

        CompletableFuture.runAsync(() -> fetchAndSaveStravaActivities(accessToken, runner.getId()));
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

    void fetchAndSaveStravaActivities(String accessToken, Long runnerId) {
        StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runnerId, ignored -> new StravaSyncTracker());
        tracker.markRunning();

        Optional<Runner> runnerOptional = runnerRepository.findById(runnerId);
        if (runnerOptional.isEmpty()) {
            tracker.markFailed("Runner account could not be found for Strava sync.");
            return;
        }

        Runner runner = runnerOptional.get();
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        int page = 1;
        boolean[] gpsRateLimited = {false};
        try {
            while (true) {
                String activitiesUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=" + page;
                ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                        activitiesUrl,
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        new ParameterizedTypeReference<List<Map<String, Object>>>() {
                        }
                );

                List<Map<String, Object>> activities = response.getBody();
                if (activities == null || activities.isEmpty()) {
                    tracker.markCompleted();
                    return;
                }

                tracker.incrementProcessedPages();
                for (Map<String, Object> activityData : activities) {
                    syncSingleStravaActivity(runner, tracker, activityData, gpsRateLimited, restTemplate, headers, accessToken);
                }

                page++;
            }
        } catch (Exception exception) {
            tracker.markFailed("Unable to sync Strava activities right now.");
        }
    }

    private void syncSingleStravaActivity(Runner runner, StravaSyncTracker tracker, Map<String, Object> activityData,
                                          boolean[] gpsRateLimited, RestTemplate restTemplate, HttpHeaders headers,
                                          String accessToken) {
        ActivityType activityType = ActivityTypeResolver.fromSportLabels(
                stringValue(activityData.get("sport_type")),
                stringValue(activityData.get("type")),
                stringValue(activityData.get("name"))
        );

        if (activityType != ActivityType.RUN) {
            tracker.incrementSkippedNonRuns();
            return;
        }

        String stravaId = stringValue(activityData.get("id"));
        if (stravaId == null || stravaId.isBlank()) {
            tracker.incrementSkippedNonRuns();
            return;
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
        } else {
            tracker.incrementImportedRuns();
        }
    }

    @SuppressWarnings("unchecked")
    private boolean fetchAndSaveGpsStream(Activity activity, String stravaId, String accessToken,
                                          RestTemplate restTemplate, HttpHeaders headers) {
        try {
            String url = "https://www.strava.com/api/v3/activities/" + stravaId + "/streams?keys=latlng";
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            List<Map<String, Object>> streams = response.getBody();
            if (streams == null) return true;

            for (Map<String, Object> stream : streams) {
                if ("latlng".equals(stream.get("type"))) {
                    List<List<Double>> data = (List<List<Double>>) stream.get("data");
                    if (data == null || data.isEmpty()) return true;

                    List<ActivityPoint> points = new ArrayList<>();
                    for (int i = 0; i < data.size(); i++) {
                        List<Double> coord = data.get(i);
                        ActivityPoint point = new ActivityPoint();
                        point.setActivity(activity);
                        point.setLatitude(coord.get(0));
                        point.setLongitude(coord.get(1));
                        point.setSequenceIndex(i);
                        points.add(point);
                    }
                    activityPointRepository.saveAll(points);
                    System.out.println("GPS cached: " + stravaId + " (" + points.size() + " pts)");
                    return true;
                }
            }
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

    /**
     * Fetch and sync a single Strava activity by its ID (used by webhook handler).
     */
    void syncStravaActivityById(Runner runner, long stravaActivityId) {
        String accessToken = resolveRunnerStravaAccessToken(runner);
        if (accessToken == null || accessToken.isBlank()) return;

        try {
            RestTemplate restTemplate = new RestTemplate();
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
                });
    }

    private boolean isGoogleConfigured() {
        return googleClientId != null && !googleClientId.isBlank()
                && googleClientSecret != null && !googleClientSecret.isBlank();
    }

    boolean isStravaConfigured() {
        return stravaClientId != null && !stravaClientId.isBlank()
                && stravaClientSecret != null && !stravaClientSecret.isBlank()
                && secretEncryptionService.isConfigured();
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
            RestTemplate rest = new RestTemplate();
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

    private String resolveEntryPage(String state) {
        return Objects.equals(state, "signup") ? "/signup" : "/login";
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

        synchronized void resetForNewSync() {
            status = "PENDING";
            importedRuns = 0;
            skippedNonRuns = 0;
            skippedDuplicates = 0;
            processedActivities = 0;
            processedPages = 0;
            error = null;
        }

        synchronized void markRunning() {
            if ("IDLE".equals(status)) {
                resetForNewSync();
            }
            status = "RUNNING";
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
        }

        synchronized void markFailed(String message) {
            status = "FAILED";
            error = message;
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
}
