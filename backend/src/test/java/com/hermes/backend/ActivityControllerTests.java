package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
                activityRepository,
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
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
            TtlCacheStore cacheStore
    ) {
        ActivityDataAccess activityDataAccess = new ActivityDataAccess(activityRepository, activityPointRepository, jdbcTemplate);
        ActivityStravaStreamService stravaStreamService = new ActivityStravaStreamService(
                activityDataAccess,
                activityRepository,
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
                readinessService,
                cacheStore
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

        Activity activity = new Activity();
        activity.setId(19L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setName("Hudson Tempo");
        activity.setDistanceKm(12.4);
        activity.setMovingTimeSeconds(3200);
        activity.setStartDate("2026-04-20");
        activity.setRoutePreviewPath("M 12.00 88.00 L 88.00 12.00");
        activity.setRoutePreviewStartX(12.0);
        activity.setRoutePreviewStartY(88.0);
        activity.setRoutePreviewFinishX(88.0);
        activity.setRoutePreviewFinishY(12.0);

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token", null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());
        List<?> body = (List<?>) response.getBody();
        assertEquals(1, body.size());

        @SuppressWarnings("unchecked")
        Map<String, Object> run = (Map<String, Object>) body.get(0);
        assertEquals("Hudson Tempo", run.get("name"));
        assertEquals(12.4, run.get("distanceKm"));
        assertInstanceOf(Map.class, run.get("routePreview"));

        @SuppressWarnings("unchecked")
        Map<String, Object> routePreview = (Map<String, Object>) run.get("routePreview");
        assertEquals("M 12.00 88.00 L 88.00 12.00", routePreview.get("path"));
        assertEquals(12.0, routePreview.get("startX"));
        assertEquals(12.0, routePreview.get("finishY"));
        verifyNoInteractions(activityPointRepository);
    }

    @Test
    void getUserRunsDoesNotHydrateOrPersistRoutePreviews() {
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
        activity.setStravaId("strava-19");
        activity.setDistanceKm(12.4);
        activity.setMovingTimeSeconds(3200);
        activity.setStartDate("2026-04-20");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of(activity));

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token", null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());
        List<?> body = (List<?>) response.getBody();
        assertEquals(1, body.size());
        assertInstanceOf(Map.class, body.get(0));

        @SuppressWarnings("unchecked")
        Map<String, Object> run = (Map<String, Object>) body.get(0);
        assertEquals("Hudson Tempo", run.get("name"));
        assertNull(run.get("routePreview"));
        verifyNoInteractions(activityPointRepository);
        verify(activityRepository, never()).save(any(Activity.class));
        verify(activityRepository, never()).saveAll(anyList());
        verifyNoInteractions(restTemplate);
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

        ResponseEntity<?> response = controller.getUserRuns("Bearer expired", null, null);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        // Must be a JSON body (Map), not a plain string, so the frontend can parse it safely.
        assertInstanceOf(java.util.Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> body = (java.util.Map<String, String>) response.getBody();
        assertNotNull(body.get("error"));
        assertNotNull(body.get("code"));
    }

    @Test
    void getUserRunReturnsSingleFeedItemWithoutFullHistoryQuery() {
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

        Runner runner = new Runner();
        runner.setId(77L);
        Activity activity = new Activity();
        activity.setId(19L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setName("Hudson Tempo");
        activity.setDistanceKm(12.4);

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(19L, runner)).thenReturn(Optional.of(activity));

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token", 19L, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(java.util.Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> run = (java.util.Map<String, Object>) response.getBody();
        assertEquals("Hudson Tempo", run.get("name"));
        assertEquals(12.4, run.get("distanceKm"));
        // The detail lookup must not enumerate the runner's whole history.
        verify(activityRepository, never()).findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class));
    }

    @Test
    void getUserRunReturns404ForMissingOrForeignActivity() {
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

        Runner runner = new Runner();
        runner.setId(77L);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(404L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token", 404L, null);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void getUserRunsLimitCapsFeedToMostRecentItems() {
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

        Runner runner = new Runner();
        runner.setId(77L);
        Activity first = new Activity();
        first.setId(3L);
        first.setRunner(runner);
        first.setActivityType(ActivityType.RUN);
        first.setName("Newest");
        Activity second = new Activity();
        second.setId(2L);
        second.setRunner(runner);
        second.setActivityType(ActivityType.RUN);
        second.setName("Middle");
        Activity third = new Activity();
        third.setId(1L);
        third.setRunner(runner);
        third.setActivityType(ActivityType.RUN);
        third.setName("Oldest");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN))
                .thenReturn(java.util.Arrays.asList(first, second, third));

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token", null, 2);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<?> body = (List<?>) response.getBody();
        assertEquals(2, body.size());
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> head = (java.util.Map<String, Object>) body.get(0);
        assertEquals("Newest", head.get("name"));
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
        assertEquals(ActivityRoutePreviewHelper.RoutePreviewAvailability.READY, body.get(0).availability());
    }

    @Test
    void getRoutePreviewBatchDoesNotFetchMissingStravaStreams() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = newController(
                authService,
                activityRepository,
                activityPointRepository,
                runnerRepository,
                secretEncryptionService,
                mock(ElevationCorrectionService.class),
                mock(AcclimatizationService.class),
                mock(ReadinessService.class),
                restTemplate,
                jdbcTemplate
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");
        runner.setStravaAccessToken("stored-token");

        Activity stravaActivity = new Activity();
        stravaActivity.setId(23L);
        stravaActivity.setRunner(runner);
        stravaActivity.setActivityType(ActivityType.RUN);
        stravaActivity.setStravaId("strava-23");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(secretEncryptionService.decrypt("stored-token")).thenReturn("access-token");
        when(activityRepository.findByIdInAndRunner(List.of(23L), runner)).thenReturn(List.of(stravaActivity));
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(23L), 240)).thenReturn(List.of());
        when(activityPointRepository.findRoutePreviewBboxesByActivityIds(List.of(23L))).thenReturn(List.of());

        ResponseEntity<?> response = controller.getRoutePreviewBatch("Bearer session-token", "23");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        List<ActivityRoutePreviewHelper.RoutePreviewBatchItem> body =
                (List<ActivityRoutePreviewHelper.RoutePreviewBatchItem>) response.getBody();
        assertEquals(1, body.size());
        assertEquals(ActivityRoutePreviewHelper.RoutePreviewAvailability.DEFERRED, body.get(0).availability());
        verifyNoInteractions(restTemplate);
        verify(activityPointRepository, never()).saveAll(anyList());
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList(), anyInt(), any());
    }

    @Test
    void getRoutePreviewBatchMarksImportedActivityWithoutGpsAsNoRoute() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        Runner runner = new Runner();
        runner.setId(77L);

        Activity importedActivity = new Activity();
        importedActivity.setId(24L);
        importedActivity.setRunner(runner);
        importedActivity.setActivityType(ActivityType.RUN);
        importedActivity.setSourceFileName("morning.fit");

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

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdInAndRunner(List.of(24L), runner)).thenReturn(List.of(importedActivity));
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(24L), 240)).thenReturn(List.of());
        when(activityPointRepository.findRoutePreviewBboxesByActivityIds(List.of(24L))).thenReturn(List.of());

        ResponseEntity<?> response = controller.getRoutePreviewBatch("Bearer session-token", "24");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        List<ActivityRoutePreviewHelper.RoutePreviewBatchItem> body =
                (List<ActivityRoutePreviewHelper.RoutePreviewBatchItem>) response.getBody();
        assertEquals(1, body.size());
        assertEquals(ActivityRoutePreviewHelper.RoutePreviewAvailability.NO_ROUTE, body.get(0).availability());
    }

    @Test
    void getRoutePreviewBatchFiltersMalformedCoordinatesBeforeReturningOrMarkingReady() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        Runner runner = new Runner();
        runner.setId(77L);

        Activity importedActivity = new Activity();
        importedActivity.setId(25L);
        importedActivity.setRunner(runner);
        importedActivity.setActivityType(ActivityType.RUN);

        Activity stravaActivity = new Activity();
        stravaActivity.setId(26L);
        stravaActivity.setRunner(runner);
        stravaActivity.setActivityType(ActivityType.RUN);
        stravaActivity.setStravaId("strava-26");

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

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdInAndRunner(List.of(25L, 26L), runner))
                .thenReturn(List.of(importedActivity, stravaActivity));
        when(activityPointRepository.findRoutePreviewSamplesByActivityIds(List.of(25L, 26L), 240)).thenReturn(List.of(
                new Object[]{25L, Double.NaN, -73.0, 0},
                new Object[]{25L, 91.0, -73.0, 1},
                new Object[]{25L, 40.0, -181.0, 2},
                new Object[]{26L, 40.0, Double.POSITIVE_INFINITY, 0},
                new Object[]{26L, -91.0, -73.0, 1}
        ));
        when(activityPointRepository.findRoutePreviewBboxesByActivityIds(List.of(25L, 26L))).thenReturn(List.of(
                new Object[]{25L, 40.0, Double.NaN, -74.0, -73.0, 12L},
                new Object[]{25L, 40.0, 39.0, -73.0, -74.0, 12L},
                new Object[]{26L, -91.0, 91.0, -181.0, 181.0, 12L}
        ));

        ResponseEntity<?> response = controller.getRoutePreviewBatch("Bearer session-token", "25,26");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        List<ActivityRoutePreviewHelper.RoutePreviewBatchItem> body =
                (List<ActivityRoutePreviewHelper.RoutePreviewBatchItem>) response.getBody();
        assertEquals(2, body.size());

        ActivityRoutePreviewHelper.RoutePreviewBatchItem importedItem = body.get(0);
        assertTrue(importedItem.points().isEmpty());
        assertNull(importedItem.bbox(), "reversed bbox must be discarded");
        assertEquals(0L, importedItem.pointCount());
        assertEquals(ActivityRoutePreviewHelper.RoutePreviewAvailability.NO_ROUTE, importedItem.availability());

        ActivityRoutePreviewHelper.RoutePreviewBatchItem stravaItem = body.get(1);
        assertTrue(stravaItem.points().isEmpty());
        assertNull(stravaItem.bbox());
        assertEquals(0L, stravaItem.pointCount());
        assertEquals(ActivityRoutePreviewHelper.RoutePreviewAvailability.DEFERRED, stravaItem.availability());
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

    @Test
    void deleteActivityEvictsRunnerHeatmapCacheWhenOwned() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        TtlCacheStore cacheStore = mock(TtlCacheStore.class);
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class), jdbcTemplate, cacheStore
        );

        Runner runner = new Runner();
        runner.setId(42L);
        Activity owned = new Activity();
        owned.setId(101L);
        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(101L, runner)).thenReturn(Optional.of(owned));

        ResponseEntity<?> response = controller.deleteActivity(101L, "Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(cacheStore).evict("profile-heatmap", "all-points-paged-v4:42");
        // The activities/heatmap read cache must also be invalidated on delete.
        verify(cacheStore).evict("activity-heatmap", "42:all");
    }

    // --- TTL read caches: second identical call is served from cache ---

    private static ActivityController cachedController(
            AuthService authService,
            ActivityPointRepository activityPointRepository,
            TtlCacheStore cacheStore
    ) {
        return newController(
                authService, mock(ActivityRepository.class), activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class),
                mock(org.springframework.jdbc.core.JdbcTemplate.class), cacheStore
        );
    }

    @Test
    void getHeatmapServesSecondCallFromCacheWithoutRequeryingCoords() {
        AuthService authService = mock(AuthService.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        ActivityController controller = cachedController(authService, activityPointRepository, cacheStore);

        Runner runner = new Runner();
        runner.setId(7L);
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(activityPointRepository.findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN)).thenReturn(List.of(
                new Object[]{40.71281234, -74.00601234},
                new Object[]{40.71411235, -74.00271236}
        ));

        ResponseEntity<?> first = controller.getHeatmapPoints("Bearer token", null);
        ResponseEntity<?> second = controller.getHeatmapPoints("Bearer token", null);

        assertEquals(HttpStatus.OK, first.getStatusCode());
        assertEquals(HttpStatus.OK, second.getStatusCode());
        List<?> firstBody = (List<?>) first.getBody();
        List<?> secondBody = (List<?>) second.getBody();
        assertEquals(2, firstBody.size());
        assertEquals(firstBody.size(), secondBody.size());
        assertArrayEquals((double[]) firstBody.get(0), (double[]) secondBody.get(0), 1e-12);
        assertArrayEquals((double[]) firstBody.get(1), (double[]) secondBody.get(1), 1e-12);
        // The full-history coordinate scan runs once; the repeat read is cache-served.
        verify(activityPointRepository, times(1)).findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN);
    }

    @Test
    void getHeatmapCacheKeysAreScopedPerRunner() {
        AuthService authService = mock(AuthService.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        ActivityController controller = cachedController(authService, activityPointRepository, cacheStore);

        Runner runnerA = new Runner();
        runnerA.setId(7L);
        Runner runnerB = new Runner();
        runnerB.setId(8L);
        when(authService.findByAuthorizationHeader("Bearer token-a")).thenReturn(Optional.of(runnerA));
        when(authService.findByAuthorizationHeader("Bearer token-b")).thenReturn(Optional.of(runnerB));
        when(activityPointRepository.findHeatmapCoordsByRunnerAndType(runnerA, ActivityType.RUN))
                .thenReturn(List.<Object[]>of(new Object[]{40.7, -74.0}));
        when(activityPointRepository.findHeatmapCoordsByRunnerAndType(runnerB, ActivityType.RUN))
                .thenReturn(List.<Object[]>of(new Object[]{41.8, -87.6}));

        ResponseEntity<?> firstA = controller.getHeatmapPoints("Bearer token-a", null);
        ResponseEntity<?> firstB = controller.getHeatmapPoints("Bearer token-b", null);
        ResponseEntity<?> secondA = controller.getHeatmapPoints("Bearer token-a", null);
        ResponseEntity<?> secondB = controller.getHeatmapPoints("Bearer token-b", null);

        assertEquals(HttpStatus.OK, firstA.getStatusCode());
        assertEquals(HttpStatus.OK, firstB.getStatusCode());
        // Each runner keeps seeing their own coordinates on every (cached) call.
        for (ResponseEntity<?> response : List.of(firstA, secondA)) {
            assertArrayEquals(new double[]{40.7, -74.0}, (double[]) ((List<?>) response.getBody()).get(0), 1e-12);
        }
        for (ResponseEntity<?> response : List.of(firstB, secondB)) {
            assertArrayEquals(new double[]{41.8, -87.6}, (double[]) ((List<?>) response.getBody()).get(0), 1e-12);
        }
        // Two runners -> two coordinate scans total, one per runner.
        verify(activityPointRepository, times(1)).findHeatmapCoordsByRunnerAndType(runnerA, ActivityType.RUN);
        verify(activityPointRepository, times(1)).findHeatmapCoordsByRunnerAndType(runnerB, ActivityType.RUN);
    }

    @Test
    void getActivityTelemetryServesSecondCallFromCacheWithoutRequeryingSamples() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class),
                mock(org.springframework.jdbc.core.JdbcTemplate.class), cacheStore
        );

        Runner runner = new Runner();
        runner.setId(7L);
        Activity activity = new Activity();
        activity.setId(51L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setMaxHeartRate(184.0);
        activity.setMovingTimeSeconds(3);

        List<Object[]> samples = new java.util.ArrayList<>();
        for (int second = 0; second < 3; second += 1) {
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

        ResponseEntity<?> first = controller.getActivityTelemetry(51L, "Bearer token");
        ResponseEntity<?> second = controller.getActivityTelemetry(51L, "Bearer token");

        assertEquals(HttpStatus.OK, first.getStatusCode());
        assertEquals(HttpStatus.OK, second.getStatusCode());
        Map<?, ?> firstBody = (Map<?, ?>) first.getBody();
        Map<?, ?> secondBody = (Map<?, ?>) second.getBody();
        assertEquals(firstBody.get("sampleCount"), secondBody.get("sampleCount"));
        assertEquals(firstBody.get("resolution"), secondBody.get("resolution"));
        Map<?, ?> firstSeries = (Map<?, ?>) firstBody.get("series");
        Map<?, ?> secondSeries = (Map<?, ?>) secondBody.get("series");
        List<?> firstHr = (List<?>) ((Map<?, ?>) firstSeries.get("heartRate")).get("samples");
        List<?> secondHr = (List<?>) ((Map<?, ?>) secondSeries.get("heartRate")).get("samples");
        assertEquals(firstHr.size(), secondHr.size());
        assertEquals(
                ((Map<?, ?>) firstHr.get(0)).get("value"),
                ((Map<?, ?>) secondHr.get(0)).get("value"));
        // The sample rebuild runs once; the repeat read is cache-served.
        verify(activityPointRepository, times(1)).findAnalyticsSamplesByActivityIdOrdered(51L);
    }

    @Test
    void getActivityTelemetryRejectsForeignActivityBeforeServingCachedEntry() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        // Poison the cache with the payload a key-collision-before-auth bug would serve.
        cacheStore.put(
                "activity-telemetry",
                "7:99",
                Map.of("sampleCount", 999, "resolution", "poisoned"),
                Duration.ofMinutes(10)
        );
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class),
                mock(org.springframework.jdbc.core.JdbcTemplate.class), cacheStore
        );

        Runner runner = new Runner();
        runner.setId(7L);
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        // Runner 7 asks for an activity they do not own.
        when(activityRepository.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getActivityTelemetry(99L, "Bearer token");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(activityPointRepository, never()).findAnalyticsSamplesByActivityIdOrdered(99L);
    }

    @Test
    void getHeartRateSamplesServesSecondCallFromCacheWithoutRequeryingSamples() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class),
                mock(org.springframework.jdbc.core.JdbcTemplate.class), cacheStore
        );

        Runner runner = new Runner();
        runner.setId(7L);
        Activity activity = new Activity();
        activity.setId(51L);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);

        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(51L, runner)).thenReturn(Optional.of(activity));
        when(activityPointRepository.findHrSamplesByActivityIdOrdered(51L)).thenReturn(List.of(
                new Object[]{0, 120},
                new Object[]{1, 122},
                new Object[]{2, 125}
        ));

        ResponseEntity<?> first = controller.getHeartRateSamples(51L, "Bearer token");
        ResponseEntity<?> second = controller.getHeartRateSamples(51L, "Bearer token");

        assertEquals(HttpStatus.OK, first.getStatusCode());
        assertEquals(HttpStatus.OK, second.getStatusCode());
        List<?> firstBody = (List<?>) first.getBody();
        List<?> secondBody = (List<?>) second.getBody();
        assertEquals(3, firstBody.size());
        assertEquals(firstBody.size(), secondBody.size());
        assertEquals(
                ((Map<?, ?>) firstBody.get(0)).get("bpm"),
                ((Map<?, ?>) secondBody.get(0)).get("bpm"));
        assertEquals(
                ((Map<?, ?>) firstBody.get(2)).get("t"),
                ((Map<?, ?>) secondBody.get(2)).get("t"));
        // The per-second sample scan runs once; the repeat read is cache-served.
        verify(activityPointRepository, times(1)).findHrSamplesByActivityIdOrdered(51L);
    }

    @Test
    void getHeartRateSamplesRejectsForeignActivityBeforeServingCachedEntry() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC());
        // Poison the cache with the payload a key-collision-before-auth bug would serve.
        cacheStore.put(
                "activity-hr-samples",
                "7:99",
                List.of(Map.of("t", 0, "bpm", 999)),
                Duration.ofMinutes(10)
        );
        ActivityController controller = newController(
                authService, activityRepository, activityPointRepository,
                mock(RunnerRepository.class), mock(SecretEncryptionService.class),
                mock(ElevationCorrectionService.class), mock(AcclimatizationService.class),
                mock(ReadinessService.class), mock(RestTemplate.class),
                mock(org.springframework.jdbc.core.JdbcTemplate.class), cacheStore
        );

        Runner runner = new Runner();
        runner.setId(7L);
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByIdAndRunner(99L, runner)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getHeartRateSamples(99L, "Bearer token");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        verify(activityPointRepository, never()).findHrSamplesByActivityIdOrdered(99L);
    }
}
