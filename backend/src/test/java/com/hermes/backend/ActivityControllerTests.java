package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActivityControllerTests {

    @Test
    void getUserRunsReturnsDtoFeedItemsWithNormalizedMetricsAndShoeMetadata() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService,
                activityRepository,
                activityPointRepository,
                runnerRepository,
                secretEncryptionService,
                elevationCorrectionService,
                acclimatizationService,
                readinessService,
                restTemplate
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());
        List<?> body = (List<?>) response.getBody();
        assertEquals(0, body.size());
    }

    @Test
    void getUserRunsBuildsAndCachesRoutePreviewFromStoredPoints() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService,
                activityRepository,
                activityPointRepository,
                runnerRepository,
                secretEncryptionService,
                elevationCorrectionService,
                acclimatizationService,
                readinessService,
                restTemplate
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");

        Activity activity = new Activity();
        activity.setId(19L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setName("Hudson Tempo");
        activity.setDistanceKm(12.4);
        activity.setMovingTimeSeconds(3200);
        activity.setStartDate("2026-04-20");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(19L), 40)).thenReturn(List.of(
                new Object[]{19L, 40.7128, -74.0060, 0},
                new Object[]{19L, 40.7141, -74.0027, 1},
                new Object[]{19L, 40.7162, -73.9988, 2}
        ));

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());
        List<?> body = (List<?>) response.getBody();
        assertEquals(1, body.size());
        assertInstanceOf(Map.class, body.get(0));

        @SuppressWarnings("unchecked")
        Map<String, Object> run = (Map<String, Object>) body.get(0);
        assertEquals("Hudson Tempo", run.get("name"));
        assertEquals(12.4, run.get("distanceKm"));
        assertInstanceOf(Map.class, run.get("routePreview"));

        @SuppressWarnings("unchecked")
        Map<String, Object> routePreview = (Map<String, Object>) run.get("routePreview");
        assertTrue(String.valueOf(routePreview.get("path")).startsWith("M "));
        assertNotNull(routePreview.get("startX"));
        assertNotNull(routePreview.get("finishY"));

        verify(activityRepository).saveAll(anyList());
    }

    @Test
    void getUserRunsCapsRoutePreviewPathToDatabaseSafeLength() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService,
                activityRepository,
                activityPointRepository,
                runnerRepository,
                secretEncryptionService,
                elevationCorrectionService,
                acclimatizationService,
                readinessService,
                restTemplate
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");

        Activity activity = new Activity();
        activity.setId(21L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setName("Long preview run");

        List<Object[]> previewSamples = new java.util.ArrayList<>();
        for (int index = 0; index < 80; index += 1) {
            previewSamples.add(new Object[]{
                    21L,
                    40.7000 + (index * 0.0005),
                    -74.0100 + (index * 0.0004),
                    index
            });
        }

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(21L), 40)).thenReturn(previewSamples);

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> body = (List<Map<String, Object>>) response.getBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> routePreview = (Map<String, Object>) body.get(0).get("routePreview");

        assertNotNull(routePreview);
        assertTrue(String.valueOf(routePreview.get("path")).length() <= 255);
        verify(activityRepository).saveAll(anyList());
    }

    @Test
    void getUserRunsReturns401JsonWhenSessionExpired() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                runnerRepository, secretEncryptionService, elevationCorrectionService,
                acclimatizationService, readinessService, restTemplate
        );

        when(authService.findByAuthorizationHeader("Bearer expired")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getUserRuns("Bearer expired");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        // Must be a JSON body (Map), not a plain string, so the frontend can parse it safely.
        assertInstanceOf(java.util.Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> body = (java.util.Map<String, String>) response.getBody();
        assertNotNull(body.get("error"));
        assertNotNull(body.get("code"));
    }

    // --- Ownership-gating tests: ActivityPoint data must be runner-scoped ---

    @Test
    void getActivityPointsRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityPoints(1L, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(activityPointRepository);
    }

    @Test
    void getActivityPointsRejectsCrossRunnerAccess() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        Runner runnerA = new Runner();
        runnerA.setId(1L);
        runnerA.setEmail("runnerA@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer token-a")).thenReturn(Optional.of(runnerA));
        // Runner A tries to access runner B's activity
        when(activityRepository.findByIdAndRunner(99L, runnerA)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityPoints(99L, "Bearer token-a");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        // ActivityPointRepository must NOT be queried when ownership check fails
        verify(activityPointRepository, never()).findLatLngByActivityIdOrdered(99L);
    }

    @Test
    void getActivityAnalyticsRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityAnalytics(1L, null, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(activityPointRepository);
    }

    @Test
    void getActivityAnalyticsRejectsCrossRunnerAccess() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        Runner runnerA = new Runner();
        runnerA.setId(1L);
        runnerA.setEmail("runnerA@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer token-a")).thenReturn(Optional.of(runnerA));
        when(activityRepository.findByIdAndRunner(99L, runnerA)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityAnalytics(99L, "Bearer token-a", null);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(activityPointRepository, never()).findAnalyticsSamplesByActivityIdOrdered(99L);
    }

    @Test
    void getHeatmapRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = new ActivityController(
                authService, mock(ActivityRepository.class), activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getHeatmapPoints(null, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(activityPointRepository);
    }
}
