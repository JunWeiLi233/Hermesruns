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

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StravaSyncServiceTests {

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static HttpEntity<?> anyHttpEntity() {
        return (HttpEntity) any(HttpEntity.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static <T> ParameterizedTypeReference<T> anyTypeRef() {
        return (ParameterizedTypeReference) any(ParameterizedTypeReference.class);
    }

    @Test
    void recentSyncScansConfiguredPagesAndUpdatesChangedDuplicateRun() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                mock(ActivityDataAccess.class)
        );
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 2);

        Runner runner = new Runner();
        runner.setId(41L);
        when(runnerRepository.findById(41L)).thenReturn(Optional.of(runner));

        Activity pageOneDuplicate = existingStravaRun(1001L, runner, "STRAVA_1001", "Morning Run", 5000d, 1500L);
        Activity pageTwoChanged = existingStravaRun(1002L, runner, "STRAVA_1002", "Old Local Title", 6000d, 1800L);

        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_1001"))
                .thenReturn(Optional.of(pageOneDuplicate));
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_1002"))
                .thenReturn(Optional.of(pageTwoChanged));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(true);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);

        String pageOneUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1";
        String pageTwoUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=2";
        when(restTemplate.exchange(eq(pageOneUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("1001", "Morning Run", 5000d, 1500L))));
        when(restTemplate.exchange(eq(pageTwoUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("1002", "Corrected Strava Title", 7000d, 2100L))));

        service.fetchAndSaveStravaActivities("token", 41L, true, "test_recent_sync");

        assertEquals("Corrected Strava Title", pageTwoChanged.getName());
        assertEquals(7000d, pageTwoChanged.getDistanceMeters());
        assertEquals(7.0d, pageTwoChanged.getDistanceKm());
        assertEquals(2100L, pageTwoChanged.getDurationSeconds());
        assertEquals(2100, pageTwoChanged.getMovingTimeSeconds());

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(41L);
        assertEquals("COMPLETED", status.status());
        assertEquals(1, status.importedRuns());
        assertEquals(1, status.skippedDuplicates());
        assertEquals(2, status.processedPages());
        assertEquals(2, status.processedActivities());

        verify(restTemplate).exchange(eq(pageTwoUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        verify(automatedCoachService).reaggregateRunner(41L);
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void activityListUnauthorizedReportsRelinkRequiredInsteadOfGenericFailure() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                mock(ActivityDataAccess.class)
        );

        Runner runner = new Runner();
        runner.setId(42L);
        when(runnerRepository.findById(42L)).thenReturn(Optional.of(runner));
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn(null);

        String pageOneUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1";
        when(restTemplate.exchange(eq(pageOneUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.UNAUTHORIZED,
                        "Unauthorized",
                        new HttpHeaders(),
                        new byte[0],
                        StandardCharsets.UTF_8
                ));

        service.fetchAndSaveStravaActivities("expired-token", 42L, true, "test_recent_sync");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(42L);
        assertEquals("FAILED", status.status());
        assertEquals("Strava authorization expired. Please relink your Strava account.", status.error());
        assertEquals(0, status.processedPages());
        assertEquals(0, status.processedActivities());
    }

    @Test
    void activityListInactiveStravaApplicationReportsConfigurationFailure() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                mock(ActivityDataAccess.class)
        );

        Runner runner = new Runner();
        runner.setId(43L);
        when(runnerRepository.findById(43L)).thenReturn(Optional.of(runner));

        String pageOneUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1";
        when(restTemplate.exchange(eq(pageOneUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.FORBIDDEN,
                        "Forbidden",
                        new HttpHeaders(),
                        "{\"message\":\"Forbidden\",\"errors\":[{\"resource\":\"Application\",\"field\":\"Status\",\"code\":\"Inactive\"}]}".getBytes(StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8
                ));

        service.fetchAndSaveStravaActivities("inactive-app-token", 43L, true, "test_recent_sync");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(43L);
        assertEquals("FAILED", status.status());
        assertEquals("Strava application is inactive. Reactivate the Strava API app or update the credentials, then reconnect Strava.", status.error());
        assertEquals(0, status.processedPages());
        assertEquals(0, status.processedActivities());
    }

    @Test
    void gpsStreamUsesAtomicWriterForCompleteNumberCoordinatesWithoutDirectPointPersistence() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                activityDataAccess
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<List<Number>> latlng = new ArrayList<>();
        for (int index = 0; index < 620; index++) {
            latlng.add(List.of(40, -74));
        }
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(List.of(Map.of("type", "latlng", "data", latlng))));

        Boolean result = ReflectionTestUtils.invokeMethod(
                service,
                "fetchAndSaveGpsStream",
                activity,
                "strava-19",
                "access-token",
                restTemplate,
                new HttpHeaders()
        );

        assertEquals(Boolean.TRUE, result);
        verify(activityDataAccess).savePointsIfAbsentAtomically(
                eq(19L),
                argThat((List<ActivityPoint> points) -> points.size() == 620)
        );
        verify(activityDataAccess, never()).savePoints(anyList());
        verify(activityPointRepository, never()).saveAll(anyList());
        verify(activityPointRepository, never()).flush();
    }

    @Test
    void gpsStreamWithInvalidCoordinatesMakesNoPersistenceCall() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                activityDataAccess
        );

        Activity activity = new Activity();
        activity.setId(19L);
        List<List<?>> invalidLatlng = List.of(
                List.of(Double.NaN, -74d),
                List.of(91d, -74d),
                List.of(40d, 181d),
                List.of("40", -74d)
        );
        when(restTemplate.exchange(
                anyString(),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(List.of(Map.of("type", "latlng", "data", invalidLatlng))));

        Boolean result = ReflectionTestUtils.invokeMethod(
                service,
                "fetchAndSaveGpsStream",
                activity,
                "strava-19",
                "access-token",
                restTemplate,
                new HttpHeaders()
        );

        assertEquals(Boolean.TRUE, result);
        verify(activityDataAccess, never()).savePointsIfAbsentAtomically(anyLong(), anyList());
        verify(activityDataAccess, never()).savePoints(anyList());
        verify(activityPointRepository, never()).saveAll(anyList());
        verify(activityPointRepository, never()).flush();
    }

    @Test
    void atomicGpsPersistenceFailureMarksActivityListSyncFailed() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatizationService = mock(AcclimatizationService.class);
        AutomatedCoachService automatedCoachService = mock(AutomatedCoachService.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        AiUsageService aiUsageService = mock(AiUsageService.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);
        ActivityDataAccess activityDataAccess = mock(ActivityDataAccess.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                acclimatizationService,
                automatedCoachService,
                applicationEventPublisher,
                aiUsageService,
                stravaTokenService,
                activityDataAccess
        );
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);

        Runner runner = new Runner();
        runner.setId(44L);
        when(runnerRepository.findById(44L)).thenReturn(Optional.of(runner));

        Activity savedActivity = new Activity();
        savedActivity.setId(19L);
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(
                runner, ImportProvider.STRAVA, "STRAVA_1001"
        )).thenReturn(Optional.empty());
        when(activityRepository.save(any(Activity.class))).thenReturn(savedActivity);
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(false);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);
        doThrow(new IllegalStateException("database unavailable"))
                .when(activityDataAccess)
                .savePointsIfAbsentAtomically(eq(19L), anyList());

        String pageOneUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1";
        when(restTemplate.exchange(eq(pageOneUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("1001", "Morning Run", 5000d, 1500L))));
        String gpsUrl = "https://www.strava.com/api/v3/activities/1001/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
        when(restTemplate.exchange(
                eq(gpsUrl),
                eq(HttpMethod.GET),
                anyHttpEntity(),
                anyTypeRef()
        )).thenReturn(ResponseEntity.ok(List.of(Map.of(
                "type", "latlng",
                "data", List.of(List.of(40, -74))
        ))));

        service.fetchAndSaveStravaActivities("token", 44L, true, "test_persistence_failure");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(44L);
        assertEquals("FAILED", status.status());
        assertEquals("Unable to sync Strava activities right now.", status.error());
        verify(activityDataAccess).savePointsIfAbsentAtomically(eq(19L), anyList());
    }

    private static Activity existingStravaRun(Long id, Runner runner, String checksum, String name, double distanceMeters, long movingSeconds) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setRunner(runner);
        activity.setProvider(ImportProvider.STRAVA);
        activity.setActivityType(ActivityType.RUN);
        activity.setSourceChecksum(checksum);
        activity.setStravaId(checksum.substring("STRAVA_".length()));
        activity.setName(name);
        activity.setDistanceMeters(distanceMeters);
        activity.setDistanceKm(distanceMeters / 1000d);
        activity.setDurationSeconds(movingSeconds);
        activity.setMovingTimeSeconds((int) movingSeconds);
        activity.setStartDate("2026-07-01T06:00:00Z");
        activity.setStartTime(LocalDateTime.of(2026, 7, 1, 6, 0));
        activity.setPacePenaltySecPerKm(0);
        activity.setWeatherAdjusted(false);
        return activity;
    }

    private static Map<String, Object> stravaActivity(String id, String name, double distanceMeters, long movingSeconds) {
        return Map.of(
                "id", id,
                "sport_type", "Run",
                "type", "Run",
                "name", name,
                "distance", distanceMeters,
                "moving_time", movingSeconds,
                "start_date_local", "2026-07-01T06:00:00Z"
        );
    }
}
