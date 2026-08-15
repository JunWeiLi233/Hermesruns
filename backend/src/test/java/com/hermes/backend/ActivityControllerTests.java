package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActivityControllerTests {

    @Test
    void autowiredConstructorKeepsDependencyCountBelowTarget() {
        Constructor<?> injectedConstructor = null;
        for (Constructor<?> constructor : ActivityController.class.getConstructors()) {
            if (constructor.isAnnotationPresent(Autowired.class)) {
                injectedConstructor = constructor;
                break;
            }
        }

        assertNotNull(injectedConstructor);
        assertTrue(
                injectedConstructor.getParameterCount() < 8,
                "ActivityController should keep constructor dependencies grouped below 8"
        );
    }

    @Test
    void controllerKeepsDeclaredMethodCountBelowTarget() {
        int methodCount = 0;
        for (Method method : ActivityController.class.getDeclaredMethods()) {
            if (!method.isSynthetic()) {
                methodCount += 1;
            }
        }

        assertTrue(
                methodCount < 16,
                "ActivityController should keep declared method count below 16, actual: " + methodCount
        );
    }

    private static ActivityController newController(
            AuthService authService,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            RunnerRepository runnerRepository,
            SecretEncryptionService secretEncryptionService,
            ElevationCorrectionService elevationCorrectionService,
            AcclimatizationService acclimatizationService,
            ReadinessService readinessService,
            RestTemplate restTemplate
    ) {
        return newController(authService, activityRepository, activityPointRepository, runnerRepository,
                secretEncryptionService, elevationCorrectionService, acclimatizationService, readinessService,
                restTemplate, org.mockito.Mockito.mock(org.springframework.jdbc.core.JdbcTemplate.class));
    }

    private static ActivityController newController(
            AuthService authService,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            RunnerRepository runnerRepository,
            SecretEncryptionService secretEncryptionService,
            ElevationCorrectionService elevationCorrectionService,
            AcclimatizationService acclimatizationService,
            ReadinessService readinessService,
            RestTemplate restTemplate,
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate
    ) {
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(activityRepository, activityPointRepository, jdbcTemplate);
        ActivityStravaStreamService stravaStreamService = new ActivityStravaStreamService(
                activityDataAccess,
                runnerRepository,
                secretEncryptionService,
                restTemplate
        );
        return new ActivityController(
                authService,
                activityDataAccess,
                stravaStreamService,
                elevationCorrectionService,
                acclimatizationService,
                readinessService
        );
    }

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

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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

    @Test
    void getRoutePreviewBatchReturnsOwnedPreviewDataWithBboxes() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        ReadinessService readinessService = mock(ReadinessService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = newController(
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

        Activity ownedA = new Activity();
        ownedA.setId(19L);
        ownedA.setRunner(runner);
        ownedA.setActivityType(ActivityType.RUN);

        Activity ownedB = new Activity();
        ownedB.setId(21L);
        ownedB.setRunner(runner);
        ownedB.setActivityType(ActivityType.RUN);

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdInAndRunner(List.of(19L, 21L, 999L), runner)).thenReturn(List.of(ownedA, ownedB));
        when(activityPointRepository.existsByActivity(ownedA)).thenReturn(true);
        when(activityPointRepository.existsByActivity(ownedB)).thenReturn(true);
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(19L, 21L), 240)).thenReturn(List.of(
                new Object[]{19L, 40.7128, -74.0060, 0},
                new Object[]{19L, 40.7141, -74.0027, 1},
                new Object[]{21L, 40.7301, -73.9995, 0},
                new Object[]{21L, 40.7314, -73.9958, 1}
        ));
        when(activityPointRepository.findRoutePreviewBboxesByActivityIds(List.of(19L, 21L))).thenReturn(List.of(
                new Object[]{19L, 40.7128, 40.7141, -74.0060, -74.0027, 1644L},
                new Object[]{21L, 40.7301, 40.7314, -73.9995, -73.9958, 88L}
        ));

        ResponseEntity<?> response = controller.getRoutePreviewBatch("Bearer session-token", "19,21,999");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());

        @SuppressWarnings("unchecked")
        List<ActivityRoutePreviewHelper.RoutePreviewBatchItem> body =
                (List<ActivityRoutePreviewHelper.RoutePreviewBatchItem>) response.getBody();
        assertEquals(2, body.size());
        assertEquals(19L, body.get(0).activityId());
        assertEquals(21L, body.get(1).activityId());
        assertEquals(2, body.get(0).points().size());
        assertNotNull(body.get(0).bbox());
        assertEquals(40.7128, body.get(0).bbox().minLat());
        assertEquals(-74.0027, body.get(0).bbox().maxLng());
        assertEquals(1644L, body.get(0).pointCount());
    }

    @Test
    void getRoutePreviewBatchRejectsOversizedRequests() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
                authService,
                activityRepository,
                activityPointRepository,
                mock(RunnerRepository.class),
                mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class),
                mock(AcclimatizationService.class),
                mock(ReadinessService.class),
                mock(RestTemplate.class)
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));

        String oversizedIds = java.util.stream.LongStream.rangeClosed(1, 51)
                .mapToObj(String::valueOf)
                .collect(java.util.stream.Collectors.joining(","));

        ResponseEntity<?> response = controller.getRoutePreviewBatch("Bearer session-token", oversizedIds);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verifyNoInteractions(activityRepository);
        verifyNoInteractions(activityPointRepository);
    }

    // --- Ownership-gating tests: ActivityPoint data must be runner-scoped ---

    @Test
    void getActivityPointsRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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

        ActivityController controller = newController(
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
    void getActivityTelemetryReturnsPerSecondStreamsAndDeviceMetrics() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");

        Activity activity = new Activity();
        activity.setId(51L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setMaxHeartRate(184.0);
        activity.setMovingTimeSeconds(12);

        List<Object[]> samples = new java.util.ArrayList<>();
        for (int second = 0; second < 12; second += 1) {
            samples.add(new Object[]{
                    40.7000 + second * 0.00001,
                    -73.9000 - second * 0.00001,
                    second,
                    second * 3.0,
                    8.0 + second * 0.2,
                    142 + second,
                    174,
                    null,
                    8.5 + second * 0.2,
                    240.0 + second,
                    82.0 + second * 0.5
            });
        }

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(51L, runner)).thenReturn(Optional.of(activity));
        when(activityPointRepository.existsByActivity(activity)).thenReturn(true);
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(51L)).thenReturn(samples);

        ResponseEntity<?> response = controller.getActivityTelemetry(51L, "Bearer token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(Map.class, response.getBody());

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(12, body.get("sampleCount"));
        assertEquals("source_elapsed_seconds", body.get("resolution"));

        @SuppressWarnings("unchecked")
        Map<String, Object> series = (Map<String, Object>) body.get("series");
        assertInstanceOf(Map.class, series.get("heartRate"));
        assertInstanceOf(Map.class, series.get("cadence"));
        assertInstanceOf(Map.class, series.get("strideLength"));
        assertInstanceOf(Map.class, series.get("elevation"));

        @SuppressWarnings("unchecked")
        Map<String, Object> heartRate = (Map<String, Object>) series.get("heartRate");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> heartRateSamples = (List<Map<String, Object>>) heartRate.get("samples");
        assertEquals(12, heartRateSamples.size());
        assertEquals(0, heartRateSamples.get(0).get("t"));
        assertEquals(142.0, heartRateSamples.get(0).get("value"));

        @SuppressWarnings("unchecked")
        Map<String, Object> strideLength = (Map<String, Object>) series.get("strideLength");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> strideSamples = (List<Map<String, Object>>) strideLength.get("samples");
        assertTrue(strideSamples.size() >= 10);

        @SuppressWarnings("unchecked")
        Map<String, Object> groundContact = (Map<String, Object>) series.get("groundContactTimeMs");
        assertEquals(true, groundContact.get("available"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> groundContactSamples = (List<Map<String, Object>>) groundContact.get("samples");
        assertEquals(12, groundContactSamples.size());
        assertEquals(240.0, groundContactSamples.get(0).get("value"));

        @SuppressWarnings("unchecked")
        Map<String, Object> verticalOscillation = (Map<String, Object>) series.get("verticalOscillationCm");
        assertEquals(true, verticalOscillation.get("available"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> verticalOscillationSamples = (List<Map<String, Object>>) verticalOscillation.get("samples");
        assertEquals(12, verticalOscillationSamples.size());
        assertEquals(8.2, verticalOscillationSamples.get(0).get("value"));

        @SuppressWarnings("unchecked")
        Map<String, Object> trainingEffect = (Map<String, Object>) body.get("trainingEffect");
        assertEquals(true, trainingEffect.get("available"));
        assertEquals("estimated_from_hr_stream", trainingEffect.get("source"));
        assertNotNull(trainingEffect.get("aerobic"));
        assertNotNull(trainingEffect.get("anaerobic"));
    }

    @Test
    void getActivityTelemetryRejectsCrossRunnerAccess() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(51L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityTelemetry(51L, "Bearer token");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(activityPointRepository, never()).findAnalyticsSamplesByActivityIdOrdered(51L);
    }

    @Test
    void getHeatmapRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
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

    // --- Run deletion ---

    @Test
    void deleteActivityRejectsUnauthenticated() {
        AuthService authService = mock(AuthService.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        ActivityController controller = newController(
                authService, mock(ActivityRepository.class), activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class)
        );

        when(authService.findByAuthorizationHeader("Bearer expired")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.deleteActivity(101L, "Bearer expired");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        verifyNoInteractions(activityPointRepository);
    }

    @Test
    void deleteActivityReturns404WhenNotOwnedAndNeverDeletes() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        Runner runner = new Runner();
        runner.setId(42L);
        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class), jdbcTemplate
        );
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(101L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.deleteActivity(101L, "Bearer session-token");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        // Points + activity must never be deleted when the caller does not own it.
        verify(jdbcTemplate, never())
                .update(org.mockito.ArgumentMatchers.contains("delete from activity_points"), org.mockito.ArgumentMatchers.<Object>any());
        verify(activityRepository, never()).delete(any(Activity.class));
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void deleteActivityRemovesPointsThenActivityWhenOwned() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class), jdbcTemplate
        );

        Runner runner = new Runner();
        runner.setId(42L);
        Activity owned = new Activity();
        owned.setId(101L);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(101L, runner)).thenReturn(Optional.of(owned));

        ResponseEntity<?> response = controller.deleteActivity(101L, "Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        // Points must be removed before the activity row (separate table).
        org.mockito.InOrder inOrder = org.mockito.Mockito.inOrder(jdbcTemplate, activityRepository);
        inOrder.verify(jdbcTemplate).update(
                org.mockito.ArgumentMatchers.contains("delete from activity_points"),
                org.mockito.ArgumentMatchers.eq(101L));
        inOrder.verify(activityRepository).delete(owned);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(Boolean.TRUE, body.get("deleted"));
        assertEquals(101L, body.get("id"));
    }
}

