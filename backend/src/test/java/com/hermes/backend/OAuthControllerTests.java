package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import java.lang.reflect.Field;
import java.net.URLDecoder;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OAuthControllerTests {

    @Test
    void authenticatedStravaLinkFlowAttachesAthleteToCurrentRunner() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController controller = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        Runner currentRunner = new Runner();
        currentRunner.setId(12L);
        currentRunner.setEmail("runner@hermes.com");
        currentRunner.setStatus("ACTIVE");
        currentRunner.setSessionToken("hashed-session-token");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(currentRunner));
        @SuppressWarnings("unchecked")
        Map<String, Object> linkBody = (Map<String, Object>) controller.createStravaLinkUrl("Bearer session-token").getBody();
        String state = extractQueryParam(String.valueOf(linkBody.get("url")), "state");

        when(restTemplate.exchange(
                eq("https://www.strava.com/oauth/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "access_token", "fresh-token",
                "refresh_token", "refresh-token",
                "expires_at", 1_800_000_000L,
                "athlete", Map.of(
                        "id", 989898L,
                        "username", "linked-runner",
                        "firstname", "Linked",
                        "lastname", "Runner"
                )
        )));
        when(runnerRepository.findByStravaAthleteId(989898L)).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+989898@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.findById(12L)).thenReturn(Optional.of(currentRunner));
        when(secretEncryptionService.encrypt("fresh-token")).thenReturn("enc-access");
        when(secretEncryptionService.encrypt("refresh-token")).thenReturn("enc-refresh");
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RedirectView redirectView = controller.handleStravaCallback("oauth-code", null, state);

        assertNotNull(redirectView.getUrl());
        assertTrue(redirectView.getUrl().contains("/profile?linking=linked"));
        assertTrue(Objects.equals(currentRunner.getStravaAthleteId(), 989898L));
        assertTrue(Objects.equals(currentRunner.getStravaAccessToken(), "enc-access"));
        verify(authService, never()).issueSessionToken(any(Runner.class));
    }

    @Test
    void authenticatedStravaLinkStateSurvivesControllerRestart() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController firstController = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );
        OAuthController restartedController = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        setField(firstController, "stravaClientId", "client-id");
        setField(firstController, "stravaClientSecret", "client-secret");
        setField(firstController, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");
        setField(restartedController, "stravaClientId", "client-id");
        setField(restartedController, "stravaClientSecret", "client-secret");
        setField(restartedController, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        Runner currentRunner = new Runner();
        currentRunner.setId(34L);
        currentRunner.setEmail("restart@hermes.com");
        currentRunner.setStatus("ACTIVE");
        currentRunner.setSessionToken("hashed-session-token");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(currentRunner));
        @SuppressWarnings("unchecked")
        Map<String, Object> linkBody = (Map<String, Object>) firstController.createStravaLinkUrl("Bearer session-token").getBody();
        String state = extractQueryParam(String.valueOf(linkBody.get("url")), "state");

        when(restTemplate.exchange(
                eq("https://www.strava.com/oauth/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "access_token", "fresh-token",
                "refresh_token", "refresh-token",
                "expires_at", 1_800_000_000L,
                "athlete", Map.of(
                        "id", 121212L,
                        "username", "restart-proof",
                        "firstname", "Restart",
                        "lastname", "Proof"
                )
        )));
        when(runnerRepository.findByStravaAthleteId(121212L)).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+121212@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.findById(34L)).thenReturn(Optional.of(currentRunner));
        when(secretEncryptionService.encrypt("fresh-token")).thenReturn("enc-access");
        when(secretEncryptionService.encrypt("refresh-token")).thenReturn("enc-refresh");
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RedirectView redirectView = restartedController.handleStravaCallback("oauth-code", null, state);

        assertNotNull(redirectView.getUrl());
        assertTrue(redirectView.getUrl().contains("/profile?linking=linked"));
        assertTrue(Objects.equals(currentRunner.getStravaAthleteId(), 121212L));
    }

    @Test
    void authenticatedStravaLinkRejectsChangedSessionFingerprint() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController controller = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        Runner currentRunner = new Runner();
        currentRunner.setId(56L);
        currentRunner.setEmail("session@hermes.com");
        currentRunner.setStatus("ACTIVE");
        currentRunner.setSessionToken("hashed-session-token");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(currentRunner));
        @SuppressWarnings("unchecked")
        Map<String, Object> linkBody = (Map<String, Object>) controller.createStravaLinkUrl("Bearer session-token").getBody();
        String state = extractQueryParam(String.valueOf(linkBody.get("url")), "state");

        currentRunner.setSessionToken("rotated-session-token");
        when(restTemplate.exchange(
                eq("https://www.strava.com/oauth/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "access_token", "fresh-token",
                "refresh_token", "refresh-token",
                "expires_at", 1_800_000_000L,
                "athlete", Map.of(
                        "id", 565656L,
                        "username", "session-proof",
                        "firstname", "Session",
                        "lastname", "Proof"
                )
        )));
        when(runnerRepository.findByStravaAthleteId(565656L)).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+565656@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.findById(56L)).thenReturn(Optional.of(currentRunner));

        RedirectView redirectView = controller.handleStravaCallback("oauth-code", null, state);

        assertNotNull(redirectView.getUrl());
        assertTrue(redirectView.getUrl().startsWith("/profile?"));
        assertTrue(redirectView.getUrl().contains("error=STRAVA_LINK_SESSION_EXPIRED"));
        assertTrue(redirectView.getUrl().contains("details="));
        assertTrue(Objects.equals(currentRunner.getStravaAthleteId(), null));
        verify(runnerRepository, never()).save(any(Runner.class));
        verify(authService, never()).issueSessionToken(any(Runner.class));
    }

    @Test
    void handleStravaCallbackAutoProvisionsRunnerForLoginState() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController controller = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);
        when(restTemplate.exchange(
                eq("https://www.strava.com/oauth/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "access_token", "fresh-token",
                "refresh_token", "refresh-token",
                "expires_at", 1_800_000_000L,
                "athlete", Map.of(
                        "id", 424242L,
                        "username", "junwei-runs",
                        "firstname", "Junwei",
                        "lastname", "Runner"
                )
        )));
        when(runnerRepository.findByStravaAthleteId(424242L)).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+424242@hermes.local")).thenReturn(Optional.empty());
        when(secretEncryptionService.encrypt("fresh-token")).thenReturn("enc-access");
        when(secretEncryptionService.encrypt("refresh-token")).thenReturn("enc-refresh");
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner saved = invocation.getArgument(0);
            saved.setId(101L);
            return saved;
        });
        when(authService.issueSessionToken(any(Runner.class))).thenReturn("session-token");

        RedirectView redirectView = controller.handleStravaCallback("oauth-code", null, "login");

        assertNotNull(redirectView.getUrl());
        assertTrue(redirectView.getUrl().contains("/profile#source=strava"));
        assertTrue(redirectView.getUrl().contains("token=session-token"));
        assertTrue(redirectView.getUrl().contains("email=strava%2B424242%40hermes.local"));
        assertTrue(redirectView.getUrl().contains("source=strava"));
        verify(runnerRepository).save(any(Runner.class));
        verify(authService).issueSessionToken(any(Runner.class));
    }

    @Test
    void fetchAndSaveStravaActivitiesRetriesOnceWithRefreshedStoredToken() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);

        OAuthController controller = new OAuthController(
                runnerRepository,
                authService,
                activityRepository,
                activityPointRepository,
                secretEncryptionService,
                aiUsageService,
                restTemplate,
                systemConfigService,
                applicationEventPublisher,
                automatedCoachService
        );

        Runner staleRunner = new Runner();
        staleRunner.setId(7L);
        staleRunner.setStravaAccessToken("encrypted-old-access");
        staleRunner.setStravaRefreshToken("encrypted-refresh");
        staleRunner.setStravaTokenExpiresAt((System.currentTimeMillis() / 1000) + 3600);

        Runner freshRunner = new Runner();
        freshRunner.setId(7L);
        freshRunner.setStravaAccessToken("encrypted-new-access");
        freshRunner.setStravaRefreshToken("encrypted-refresh");
        freshRunner.setStravaTokenExpiresAt((System.currentTimeMillis() / 1000) + 3600);

        Activity existingActivity = new Activity();
        existingActivity.setId(88L);
        existingActivity.setActivityType(ActivityType.RUN);
        existingActivity.setRunner(freshRunner);

        when(runnerRepository.findById(7L)).thenReturn(Optional.of(staleRunner), Optional.of(freshRunner));
        when(secretEncryptionService.decrypt("encrypted-new-access")).thenReturn("fresh-access-token");
        when(secretEncryptionService.decrypt("encrypted-refresh")).thenReturn("refresh-token");
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(freshRunner, ImportProvider.STRAVA, "STRAVA_12345"))
                .thenReturn(Optional.of(existingActivity));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(true);

        HttpClientErrorException unauthorized = HttpClientErrorException.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                HttpHeaders.EMPTY,
                new byte[0],
                null
        );
        ResponseEntity<List<Map<String, Object>>> activityPage = ResponseEntity.ok(List.of(Map.of(
                "id", "12345",
                "sport_type", "Run",
                "type", "Run",
                "name", "Park Loop",
                "distance", 6400.0,
                "moving_time", 1700,
                "start_date_local", "2026-04-05T07:15:00Z"
        )));

        when(restTemplate.exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenThrow(unauthorized).thenReturn(activityPage);

        when(restTemplate.exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=2"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(List.of()));

        controller.fetchAndSaveStravaActivities("stale-access-token", 7L, false, "test_retry");

        verify(restTemplate, times(2)).exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        );
        verify(runnerRepository, times(2)).findById(7L);
        verify(activityRepository).save(any(Activity.class));
    }

    @Test
    void getAuthProvidersReturnsBothProvidersConfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(systemConfigService.isGoogleConfigured()).thenReturn(true);
        when(systemConfigService.isStravaConfigured()).thenReturn(true);

        var response = controller.getAuthProviders();

        assertNotNull(response.getBody());
        assertTrue((Boolean) response.getBody().get("googleConfigured"));
        assertTrue((Boolean) response.getBody().get("stravaConfigured"));
    }

    @Test
    void getAuthProvidersReturnsBothProvidersUnconfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(systemConfigService.isGoogleConfigured()).thenReturn(false);
        when(systemConfigService.isStravaConfigured()).thenReturn(false);

        var response = controller.getAuthProviders();

        assertNotNull(response.getBody());
        assertTrue(!(Boolean) response.getBody().get("googleConfigured"));
        assertTrue(!(Boolean) response.getBody().get("stravaConfigured"));
    }

    @Test
    void getStravaStatusReturnsUnauthorizedWithoutToken() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        when(systemConfigService.getStravaStatus()).thenReturn(Map.of());

        var response = controller.getStravaStatus(null);

        assertNotNull(response.getBody());
        assertTrue(!(Boolean) response.getBody().get("linked"));
    }

    @Test
    void getStravaStatusReturnsLinkedWhenAthleteIdPresent() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setStravaAthleteId(12345L);
        runner.setStravaRefreshToken("refresh-token");

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(systemConfigService.getStravaStatus()).thenReturn(Map.of());

        var response = controller.getStravaStatus("Bearer token");

        assertNotNull(response.getBody());
        assertTrue((Boolean) response.getBody().get("linked"));
        assertTrue(response.getBody().containsKey("syncStatus"));
    }

    @Test
    void getStravaStatusIncludesActiveSyncSnapshot() throws Exception {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setStravaAthleteId(12345L);
        runner.setStravaRefreshToken("refresh-token");
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(systemConfigService.getStravaStatus()).thenReturn(Map.of());

        ReflectionTestUtils.setField(controller, "stravaSyncStates", new java.util.concurrent.ConcurrentHashMap<>());
        @SuppressWarnings("unchecked")
        java.util.concurrent.ConcurrentMap<Long, Object> syncStates =
                (java.util.concurrent.ConcurrentMap<Long, Object>) ReflectionTestUtils.getField(controller, "stravaSyncStates");

        Class<?> trackerClass = Class.forName("com.hermes.backend.OAuthController$StravaSyncTracker");
        var constructor = trackerClass.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object tracker = constructor.newInstance();
        var tryQueueSync = trackerClass.getDeclaredMethod("tryQueueSync", String.class, boolean.class);
        tryQueueSync.setAccessible(true);
        tryQueueSync.invoke(tracker, "app_open_catch_up", true);
        syncStates.put(1L, tracker);

        var response = controller.getStravaStatus("Bearer token");

        assertNotNull(response.getBody());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = response.getBody();
        assertTrue((Boolean) body.get("linked"));
        assertTrue(body.containsKey("syncStatus"));
        assertEquals("webhook_retry_burst_then_on_open_catch_up", body.get("autoUpdateMode"));
    }

    @Test
    void getStravaStatusReturnsNotLinkedWhenNoStravaAccount() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setStravaAthleteId(null);
        runner.setStravaRefreshToken(null);

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(systemConfigService.getStravaStatus()).thenReturn(Map.of());

        var response = controller.getStravaStatus("Bearer token");

        assertNotNull(response.getBody());
        assertTrue(!(Boolean) response.getBody().get("linked"));
    }

    @Test
    void createStravaLinkUrlReturnsUnauthorizedWithoutSession() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        var response = controller.createStravaLinkUrl(null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Invalid session", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void createStravaLinkUrlReturnsServiceUnavailableWhenStravaNotConfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(systemConfigService.isStravaConfigured()).thenReturn(false);

        var response = controller.createStravaLinkUrl("Bearer token");

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Strava sign-in is not configured.", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void handleGoogleCallbackRedirectsToErrorWhenGoogleNotConfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(systemConfigService.isGoogleConfigured()).thenReturn(false);

        RedirectView redirect = controller.handleGoogleCallback("code", "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("error="));
        assertTrue(redirect.getUrl().contains("Google"));
    }

    @Test
    void handleGoogleCallbackRedirectsToErrorWhenCodeMissing() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(systemConfigService.isGoogleConfigured()).thenReturn(true);

        RedirectView redirect = controller.handleGoogleCallback(null, "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("error="));
    }

    @Test
    void handleGoogleCallbackRedirectsToErrorWhenTokenExchangeFails() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, restTemplate,
                systemConfigService, null, null
        );

        setField(controller, "googleClientId", "client-id");
        setField(controller, "googleClientSecret", "client-secret");
        setField(controller, "googleRedirectUri", "http://localhost:8080/api/auth/google/callback");

        when(systemConfigService.isGoogleConfigured()).thenReturn(true);
        when(restTemplate.exchange(
                eq("https://oauth2.googleapis.com/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenThrow(new org.springframework.web.client.RestClientException("token error"));

        RedirectView redirect = controller.handleGoogleCallback("code", "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("error="));
    }

    @Test
    void handleStravaCallbackRedirectsToErrorWhenStravaNotConfigured() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        when(systemConfigService.isStravaConfigured()).thenReturn(false);

        RedirectView redirect = controller.handleStravaCallback("code", null, "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("STRAVA_NOT_CONFIGURED"));
    }

    @Test
    void handleStravaCallbackRedirectsToErrorWhenErrorParamPresent() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);

        RedirectView redirect = controller.handleStravaCallback(null, "access_denied", "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("STRAVA_OAUTH_ERROR"));
    }

    @Test
    void handleStravaCallbackRedirectsToErrorWhenCodeMissing() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);

        RedirectView redirect = controller.handleStravaCallback(null, null, "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("STRAVA_MISSING_CODE"));
    }

    @Test
    void handleStravaCallbackRedirectsToErrorWhenTokenResponseInvalid() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, restTemplate,
                systemConfigService, null, null
        );

        setField(controller, "stravaClientId", "client-id");
        setField(controller, "stravaClientSecret", "client-secret");
        setField(controller, "stravaRedirectUri", "http://localhost:8080/api/auth/strava/callback");

        when(systemConfigService.isStravaConfigured()).thenReturn(true);
        when(restTemplate.exchange(
                eq("https://www.strava.com/oauth/token"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenReturn(ResponseEntity.ok(Map.of("access_token", "", "athlete", Map.of("id", 12345L))));

        RedirectView redirect = controller.handleStravaCallback("code", null, "state");

        assertNotNull(redirect.getUrl());
        assertTrue(redirect.getUrl().contains("STRAVA_OAUTH_INVALID_RESPONSE"));
    }

    @Test
    void reSyncStravaReturnsUnauthorizedWithoutSession() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        var response = controller.reSyncStrava(null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Invalid or expired session token.", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void triggerOnOpenStravaCatchUpReturnsNotLinkedWhenRunnerHasNoStrava() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(12L);
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        var response = controller.triggerOnOpenStravaCatchUp("Bearer token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("NOT_LINKED", ((Map<?, ?>) response.getBody()).get("status"));
    }

    @Test
    void reSyncStravaReturnsOkWhenNoStravaLinked() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, secretEncryptionService, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setStravaAccessToken(null);
        runner.setStravaRefreshToken(null);

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        var response = controller.reSyncStrava("Bearer token");

        assertEquals("No Strava account linked", response.getBody());
    }

    @Test
    void verifySessionReturnsUnauthorizedWithoutSession() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        var response = controller.verifySession(null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Invalid or expired session token.", ((Map<?, ?>) response.getBody()).get("error"));
    }

    @Test
    void verifySessionReturnsRunnerInfoWhenAuthenticated() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AuthService authService = mock(AuthService.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);

        OAuthController controller = new OAuthController(
                runnerRepository, authService, null, null, null, null, null,
                systemConfigService, null, null
        );

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setEmail("test@hermes.com");
        runner.setRole("USER");
        runner.setStatus("ACTIVE_STRAVA");

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));

        var response = controller.verifySession("Bearer token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("test@hermes.com", ((Map<?, ?>) response.getBody()).get("email"));
        assertEquals("USER", ((Map<?, ?>) response.getBody()).get("role"));
        assertEquals("ACTIVE_STRAVA", ((Map<?, ?>) response.getBody()).get("status"));
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Failed to set field " + fieldName, exception);
        }
    }

    private static String extractQueryParam(String url, String name) {
        String query = url.substring(url.indexOf('?') + 1);
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && parts[0].equals(name)) {
                return URLDecoder.decode(parts[1], java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        throw new AssertionError("Missing query param " + name + " in " + url);
    }
}
