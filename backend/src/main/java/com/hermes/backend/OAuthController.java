package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class OAuthController {
    private static final Logger logger = LoggerFactory.getLogger(OAuthController.class);

    private final RunnerRepository runnerRepository;
    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final SystemConfigService systemConfigService;
    private final AiUsageService aiUsageService;
    private final RestTemplate restTemplate;
    private final StravaTokenService stravaTokenService;
    private final StravaSyncService stravaSyncService;

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

    @Value("${recaptcha.site-key:}")
    private String recaptchaSiteKey;

    @Value("${recaptcha.secret-key:}")
    private String recaptchaSecretKey;

    public OAuthController(RunnerRepository runnerRepository, AuthService authService,
                           ActivityRepository activityRepository,
                           SecretEncryptionService secretEncryptionService, AiUsageService aiUsageService,
                           RestTemplate restTemplate,
                           SystemConfigService systemConfigService,
                           StravaTokenService stravaTokenService,
                           StravaSyncService stravaSyncService) {
        this.runnerRepository = runnerRepository;
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.aiUsageService = aiUsageService;
        this.restTemplate = restTemplate;
        this.systemConfigService = systemConfigService;
        this.stravaTokenService = stravaTokenService;
        this.stravaSyncService = stravaSyncService;
    }

    // ── Auth providers ──────────────────────────────────────────────

    @GetMapping("/auth/providers")
    public ResponseEntity<Map<String, Object>> getAuthProviders() {
        Map<String, Object> response = new HashMap<>();
        response.put("googleConfigured", systemConfigService.isGoogleConfigured());
        response.put("stravaConfigured", systemConfigService.isStravaConfigured());
        response.put("recaptchaSiteKey", recaptchaSiteKey);
        response.put("recaptchaRequired", hasText(recaptchaSecretKey));
        response.put("recaptchaConfigured", hasText(recaptchaSecretKey) && hasText(recaptchaSiteKey));
        return ResponseEntity.ok(response);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @GetMapping("/auth/strava/status")
    public ResponseEntity<Map<String, Object>> getStravaStatus(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Map<String, Object> status = new HashMap<>(systemConfigService.getStravaStatus());
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        boolean linked = runnerOptional
                .map(stravaTokenService::isRunnerStravaLinked)
                .orElse(false);
        status.put("linked", linked);
        status.put("syncStatus", runnerOptional
                .map(runner -> stravaSyncService.snapshotSyncStatus(runner.getId()))
                .orElse(StravaSyncService.StravaSyncStatusResponse.idle()));
        status.put("autoUpdateMode", "webhook_retry_burst_then_on_open_catch_up");
        return ResponseEntity.ok(status);
    }

    // ── Google OAuth ────────────────────────────────────────────────

    @GetMapping("/auth/google/start")
    public RedirectView startGoogleAuth(@RequestParam(required = false) String state) {
        if (!isGoogleConfigured()) {
            return errorRedirectCode(
                    "GOOGLE_NOT_CONFIGURED",
                    "Google sign-in is not configured.",
                    state
            );
        }

        UriComponentsBuilder builder = UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                .queryParam("client_id", googleClientId)
                .queryParam("redirect_uri", googleRedirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "email profile");

        if (state != null && !state.isBlank()) {
            builder.queryParam("state", state);
        }

        return new RedirectView(builder.toUriString());
    }

    @GetMapping("/auth/google/callback")
    public RedirectView handleGoogleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state
    ) {
        if (!isGoogleConfigured()) {
            return errorRedirectCode(
                    "GOOGLE_NOT_CONFIGURED",
                    "Google sign-in is not configured.",
                    state
            );
        }

        if (code == null || code.isBlank()) {
            return errorRedirectCode("GOOGLE_FAILED", "Google sign-in failed.", state);
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
                return errorRedirectCode("GOOGLE_FAILED", "Google sign-in failed.", state);
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
                return errorRedirectCode("GOOGLE_FAILED", "Google sign-in failed.", state);
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
            return errorRedirectCode("GOOGLE_FAILED", "Google sign-in failed.", state);
        }
    }

    // ── Strava OAuth ────────────────────────────────────────────────

    @GetMapping("/auth/strava/start")
    public RedirectView startStravaAuth(@RequestParam(required = false) String state) {
        if (!stravaTokenService.isStravaConfigured()) {
            return errorRedirectCode(
                    "STRAVA_NOT_CONFIGURED",
                    "Strava sign-in is not configured.",
                    state
            );
        }
        return new RedirectView(stravaTokenService.buildStravaAuthUrl(state));
    }

    @PostMapping("/auth/strava/link-url")
    public ResponseEntity<?> createStravaLinkUrl(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid session"));
        }
        if (!stravaTokenService.isStravaConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "Strava sign-in is not configured."));
        }

        return ResponseEntity.ok(Map.of(
                "url", stravaTokenService.buildStravaAuthUrl(stravaTokenService.createProfileLinkState(runnerOptional.get())),
                "expiresInSeconds", 600L
        ));
    }

    @GetMapping("/auth/strava/callback")
    public RedirectView handleStravaCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String state
    ) {
        if (!stravaTokenService.isStravaConfigured()) {
            logger.warn("[Hermes] Strava OAuth callback hit but Strava is not configured.");
            return errorRedirectCode(
                    "STRAVA_NOT_CONFIGURED",
                    "Strava OAuth is not configured on this server.",
                    state
            );
        }

        if (error != null && !error.isBlank()) {
            logger.warn("[Hermes] Strava OAuth callback returned error: {}", error);
            return errorRedirectCode(
                    "STRAVA_OAUTH_ERROR",
                    "Strava returned an error.",
                    state
            );
        }

        if (code == null || code.isBlank()) {
            logger.warn("[Hermes] Strava OAuth callback missing authorization code.");
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

            Optional<StravaTokenService.PendingStravaLinkRequest> pendingLinkRequest = stravaTokenService.decodeProfileLinkState(state);
            Optional<Runner> linkedRunner = runnerRepository.findByStravaAthleteId(athleteId)
                    .filter(existingRunner -> !existingRunner.isDeleted());
            Optional<Runner> legacyShadowRunner = runnerRepository.findByEmailIgnoreCase(stravaTokenService.stravaEmail(athleteId))
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
                if (shouldAutoProvisionStravaRunner(state)) {
                    Runner newRunner = buildNewStravaRunner(athlete, athleteId, accessToken, refreshToken, expiresAt);
                    newRunner = runnerRepository.save(newRunner);

                    Long runnerId = newRunner.getId();
                    stravaSyncService.scheduleStravaSync(newRunner, accessToken, false, "oauth_login");

                    String token = authService.issueSessionToken(newRunner);
                    String targetPage = authService.isAdmin(newRunner) ? "/dashboard" : "/profile";

                    return new RedirectView(
                            targetPage
                                    + "#source=strava"
                                    + "&token=" + urlEncode(token)
                                    + "&email=" + urlEncode(newRunner.getEmail())
                    );
                }
                return stravaLinkConfirmationRedirect(state, athleteId, athlete);
            }

            Runner runner = linkedRunner.orElseGet(legacyShadowRunner::get);

            if (runner.getEmail() == null || runner.getEmail().isBlank()) {
                runner.setEmail(stravaTokenService.stravaEmail(athleteId));
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

            stravaSyncService.scheduleStravaSync(runner, accessToken, false, "oauth_link");

            String token = authService.issueSessionToken(runner);
            String targetPage = authService.isAdmin(runner) ? "/dashboard" : "/profile";

            return new RedirectView(
                    targetPage
                            + "#source=strava"
                            + "&token=" + urlEncode(token)
                            + "&email=" + urlEncode(runner.getEmail())
            );
        } catch (Exception exception) {
            logger.error("[Hermes] Strava OAuth callback failed: {} - {}", exception.getClass().getSimpleName(), exception.getMessage(), exception);
            return errorRedirectCode(
                    "STRAVA_OAUTH_FAILED",
                    exception.getClass().getSimpleName() + ": " + safeMessage(exception),
                    state
            );
        }
    }

    // ── Strava sync endpoints ───────────────────────────────────────

    @GetMapping("/strava/sync")
    public ResponseEntity<?> reSyncStrava(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {

        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
        }

        Runner runner = runnerOpt.get();
        String accessToken;
        try {
            accessToken = stravaTokenService.resolveRunnerStravaAccessToken(runner);
        } catch (Exception ex) {
            logger.warn("Strava sync skipped for runner {}: {}", runner.getId(), ex.getMessage(), ex);
            return ResponseEntity.ok("Strava token is invalid; please relink your Strava account.");
        }
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.ok("No Strava account linked");
        }

        return switch (stravaSyncService.scheduleStravaSync(runner, accessToken, false, "manual_resync")) {
            case STARTED, ALREADY_RUNNING -> ResponseEntity.ok("Strava sync started");
            case NOT_LINKED -> ResponseEntity.ok("No Strava account linked");
            case RELINK_REQUIRED -> ResponseEntity.ok("Strava token is invalid; please relink your Strava account.");
        };
    }

    @GetMapping("/auth/strava/auto-sync")
    public ResponseEntity<?> triggerOnOpenStravaCatchUp(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired session token."));
        }

        Runner runner = runnerOpt.get();
        String accessToken;
        try {
            accessToken = stravaTokenService.resolveRunnerStravaAccessToken(runner);
        } catch (Exception ex) {
            logger.warn("Strava catch-up skipped for runner {}: {}", runner.getId(), ex.getMessage(), ex);
            return ResponseEntity.ok(Map.of(
                    "started", false,
                    "status", "RELINK_REQUIRED",
                    "message", "Strava authorization expired. Please relink your account."
            ));
        }
        if (accessToken == null || accessToken.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "started", false,
                    "status", "NOT_LINKED",
                    "message", "No Strava account linked."
            ));
        }

        StravaSyncService.SyncLaunchResult launch = stravaSyncService.scheduleStravaSync(runner, accessToken, true, "app_open_catch_up");
        return switch (launch) {
            case STARTED -> ResponseEntity.ok(Map.of(
                    "started", true,
                    "status", "STARTED",
                    "message", "Strava catch-up started."
            ));
            case ALREADY_RUNNING -> ResponseEntity.ok(Map.of(
                    "started", false,
                    "status", "ALREADY_RUNNING",
                    "message", "Strava sync is already running."
            ));
            case NOT_LINKED -> ResponseEntity.ok(Map.of(
                    "started", false,
                    "status", "NOT_LINKED",
                    "message", "No Strava account linked."
            ));
            case RELINK_REQUIRED -> ResponseEntity.ok(Map.of(
                    "started", false,
                    "status", "RELINK_REQUIRED",
                    "message", "Strava authorization expired. Please relink your account."
            ));
        };
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
        return ResponseEntity.ok(stravaSyncService.snapshotSyncStatus(runner.getId()));
    }

    // ── Session ─────────────────────────────────────────────────────

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

    // ── Strava callback helpers (tightly coupled to OAuth redirect flow) ──

    @Transactional
    RedirectView completeAuthenticatedStravaLink(
            StravaTokenService.PendingStravaLinkRequest pendingLinkRequest,
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

        stravaSyncService.scheduleStravaSync(currentRunner, accessToken, false, "strava_link_confirmed");

        return new RedirectView("/profile?linking=linked");
    }

    @Transactional
    void mergeLegacyShadowRunnerIntoCurrent(Runner currentRunner, Runner shadowRunner) {
        if (currentRunner.getDisplayName() == null || currentRunner.getDisplayName().isBlank()) {
            currentRunner.setDisplayName(shadowRunner.getDisplayName());
        }

        java.util.List<Activity> shadowActivities = activityRepository.findByRunnerOrderByIdDesc(shadowRunner);
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

    private boolean shouldAutoProvisionStravaRunner(String state) {
        if (stravaTokenService.isProfileLinkState(state) || Objects.equals(state, "profile-link")) {
            return false;
        }
        return state == null
                || state.isBlank()
                || Objects.equals(state, "login")
                || Objects.equals(state, "signup");
    }

    private Runner buildNewStravaRunner(
            Map<String, Object> athlete,
            Long athleteId,
            String accessToken,
            String refreshToken,
            Long expiresAt
    ) {
        Runner runner = new Runner();
        runner.setEmail(stravaTokenService.stravaEmail(athleteId));
        runner.setRole("USER");
        runner.setStatus("ACTIVE_STRAVA");
        runner.setDeleted(false);
        runner.setStravaAthleteId(athleteId);
        runner.setStravaUsername(stringValue(athlete.get("username")));
        runner.setStravaAccessToken(secretEncryptionService.encrypt(accessToken));
        runner.setStravaRefreshToken(secretEncryptionService.encrypt(refreshToken));
        runner.setStravaTokenExpiresAt(expiresAt);
        runner.setDisplayName(resolveStravaDisplayName(athlete, athleteId));
        runner.setEmailVerified(true);
        aiUsageService.initNewUser(runner);
        return runner;
    }

    // ── Shared helpers ──────────────────────────────────────────────

    private boolean isGoogleConfigured() {
        return systemConfigService.isGoogleConfigured();
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

    private String safeMessage(Exception exception) {
        try {
            String msg = exception.getMessage();
            if (msg == null) return "";
            msg = msg.trim();
            return msg.length() > 200 ? msg.substring(0, 200) : msg;
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveEntryPage(String state) {
        if (stravaTokenService.isProfileLinkState(state) || Objects.equals(state, "profile-link")) {
            return "/profile";
        }
        return Objects.equals(state, "signup") ? "/signup" : "/login";
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

    // ── Type conversion utilities ───────────────────────────────────

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

    private String blankToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
