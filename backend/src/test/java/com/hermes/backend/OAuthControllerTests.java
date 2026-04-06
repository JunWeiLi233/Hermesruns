package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.view.RedirectView;

import java.lang.reflect.Field;
import java.net.URLDecoder;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

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
        assertTrue(redirectView.getUrl().contains("/profile?linking=confirmation_required"));
        assertTrue(redirectView.getUrl().contains("error=STRAVA_LINK_SESSION_EXPIRED"));
        assertTrue(Objects.equals(currentRunner.getStravaAthleteId(), null));
        verify(runnerRepository, never()).save(any(Runner.class));
        verify(authService, never()).issueSessionToken(any(Runner.class));
    }

    @Test
    void handleStravaCallbackRedirectsToManualConfirmationInsteadOfCreatingShadowRunner() {
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

        RedirectView redirectView = controller.handleStravaCallback("oauth-code", null, "login");

        assertNotNull(redirectView.getUrl());
        assertTrue(redirectView.getUrl().contains("/login?error=STRAVA_LINK_CONFIRMATION_REQUIRED"));
        assertTrue(redirectView.getUrl().contains("source=strava"));
        assertTrue(redirectView.getUrl().contains("linking=confirmation_required"));
        verify(runnerRepository, never()).save(any(Runner.class));
        verify(authService, never()).issueSessionToken(any(Runner.class));
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

        controller.fetchAndSaveStravaActivities("stale-access-token", 7L, false);

        verify(restTemplate, times(2)).exchange(
                eq("https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        );
        verify(runnerRepository, times(2)).findById(7L);
        verify(activityRepository).save(any(Activity.class));
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
