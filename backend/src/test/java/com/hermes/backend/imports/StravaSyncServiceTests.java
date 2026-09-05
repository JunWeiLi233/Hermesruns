package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.billing.AiUsageService;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.weather.AcclimatizationService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

    private static boolean isBootstrapRecentPage(String url, int page) {
        String prefix = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page="
                + page + "&after=";
        if (url == null || !url.startsWith(prefix)) {
            return false;
        }
        try {
            return Long.parseLong(url.substring(prefix.length())) >= 0L;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static String bootstrapRecentPage(int page) {
        return argThat(url -> isBootstrapRecentPage(url, page));
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

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("1001", "Morning Run", 5000d, 1500L))));
        when(restTemplate.exchange(bootstrapRecentPage(2), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
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

        verify(restTemplate).exchange(bootstrapRecentPage(2), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
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

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
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

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
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

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
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

    @Test
    void recentSyncUsesCursorAfterParamAndAdvancesCursorOnSuccess() {
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
        runner.setId(45L);
        runner.setStravaListCursorEpoch(1_000_000L);
        when(runnerRepository.findById(45L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // cursor 1,000,000 minus the default 21,600s buffer -> after=978400
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of()));

        long beforeSyncEpoch = Instant.now().getEpochSecond();
        service.fetchAndSaveStravaActivities("token", 45L, true, "test_cursor_sync");

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, times(1)).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        assertEquals(1, urlCaptor.getAllValues().size());
        assertTrue(urlCaptor.getValue().contains("/athlete/activities"), "expected the activities list endpoint");
        assertTrue(urlCaptor.getValue().contains("after=978400"), "expected the cursor after param, got: " + urlCaptor.getValue());

        ArgumentCaptor<Runner> runnerCaptor = ArgumentCaptor.forClass(Runner.class);
        verify(runnerRepository).save(runnerCaptor.capture());
        assertNotNull(runnerCaptor.getValue().getStravaListCursorEpoch());
        assertTrue(runnerCaptor.getValue().getStravaListCursorEpoch() >= beforeSyncEpoch,
                "cursor must advance to at least the sync start epoch");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(45L);
        assertEquals("COMPLETED", status.status());
    }

    @Test
    void recentSyncWithoutCursorUsesBootstrapLookbackAndSetsCursor() {
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
        runner.setId(46L);
        when(runnerRepository.findById(46L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_1001"))
                .thenReturn(Optional.empty());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(true);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("1001", "Morning Run", 5000d, 1500L))))
                .thenReturn(ResponseEntity.ok(List.of()));

        long beforeSyncEpoch = Instant.now().getEpochSecond();
        service.fetchAndSaveStravaActivities("token", 46L, true, "test_no_cursor_sync");
        long afterSyncEpoch = Instant.now().getEpochSecond();

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, times(2)).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        assertEquals(2, urlCaptor.getAllValues().size());
        String firstUrl = urlCaptor.getAllValues().get(0);
        String secondUrl = urlCaptor.getAllValues().get(1);
        assertTrue(firstUrl.contains("&page=1&after="), "missing-cursor recent sync must be bounded, got: " + firstUrl);
        assertTrue(secondUrl.contains("&page=2&after="), "all pages must share the bootstrap bound, got: " + secondUrl);

        long firstAfter = Long.parseLong(firstUrl.substring(firstUrl.lastIndexOf("&after=") + "&after=".length()));
        long secondAfter = Long.parseLong(secondUrl.substring(secondUrl.lastIndexOf("&after=") + "&after=".length()));
        long bootstrapWindowSeconds = 14L * 24L * 60L * 60L;
        assertEquals(firstAfter, secondAfter);
        assertTrue(firstAfter >= beforeSyncEpoch - bootstrapWindowSeconds,
                "bootstrap bound must not precede the configured lookback window");
        assertTrue(firstAfter <= afterSyncEpoch - bootstrapWindowSeconds,
                "bootstrap bound must cover the full configured lookback window");

        ArgumentCaptor<Runner> runnerCaptor = ArgumentCaptor.forClass(Runner.class);
        verify(runnerRepository).save(runnerCaptor.capture());
        assertNotNull(runnerCaptor.getValue().getStravaListCursorEpoch());
        assertTrue(runnerCaptor.getValue().getStravaListCursorEpoch() >= beforeSyncEpoch);

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(46L);
        assertEquals("COMPLETED", status.status());
        assertEquals(1, status.importedRuns());
        assertEquals(1, status.processedPages());
    }

    @Test
    void negativeBootstrapLookbackClampsAfterToSyncStart() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        StravaSyncService service = new StravaSyncService(
                activityRepository,
                activityPointRepository,
                runnerRepository,
                restTemplate,
                mock(AcclimatizationService.class),
                mock(AutomatedCoachService.class),
                mock(ApplicationEventPublisher.class),
                mock(AiUsageService.class),
                mock(StravaTokenService.class),
                mock(ActivityDataAccess.class)
        );
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);
        ReflectionTestUtils.setField(service, "bootstrapLookbackDays", -5L);

        Runner runner = new Runner();
        runner.setId(53L);
        when(runnerRepository.findById(53L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of()));

        long beforeSyncEpoch = Instant.now().getEpochSecond();
        service.fetchAndSaveStravaActivities("token", 53L, true, "test_negative_bootstrap");
        long afterSyncEpoch = Instant.now().getEpochSecond();

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        String url = urlCaptor.getValue();
        long afterParam = Long.parseLong(url.substring(url.lastIndexOf("&after=") + "&after=".length()));
        assertTrue(afterParam >= beforeSyncEpoch, "negative lookback must clamp to the sync start");
        assertTrue(afterParam <= afterSyncEpoch, "clamped bootstrap bound must not be in the future");
    }

    @Test
    void failedListSyncDoesNotAdvanceCursor() {
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
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);

        Runner runner = new Runner();
        runner.setId(47L);
        runner.setStravaListCursorEpoch(1_000_000L);
        when(runnerRepository.findById(47L)).thenReturn(Optional.of(runner));

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Too Many Requests",
                        new HttpHeaders(),
                        new byte[0],
                        StandardCharsets.UTF_8
                ));

        service.fetchAndSaveStravaActivities("token", 47L, true, "test_failed_list_sync");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(47L);
        assertEquals("FAILED", status.status());
        assertEquals("Strava rate limit reached. Try again later.", status.error());
        verify(runnerRepository, never()).save(any(Runner.class));
        assertEquals(1_000_000L, runner.getStravaListCursorEpoch());
    }

    @Test
    void treadmillRunIsTombstonedAndSkippedOnLaterSyncs() {
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
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);

        Runner runner = new Runner();
        runner.setId(48L);
        when(runnerRepository.findById(48L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_2001"))
                .thenReturn(Optional.empty());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            // Mirror real JPA save(): assign an id so later lookups treat it as existing.
            Activity saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(2001L);
            }
            return saved;
        });
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(false);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("2001", "Treadmill Run", 5000d, 1500L))));
        String streamsUrl = "https://www.strava.com/api/v3/activities/2001/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
        when(restTemplate.exchange(eq(streamsUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(Map.of("type", "time", "data", List.of(0, 1, 2)))));

        // First sync: the run is new, its stream has no latlng -> tombstoned.
        service.fetchAndSaveStravaActivities("token", 48L, true, "test_treadmill_first");

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, atLeastOnce()).save(activityCaptor.capture());
        assertTrue(activityCaptor.getAllValues().stream().anyMatch(saved ->
                        "NO_GPS".equals(saved.getGpsStreamState()) && saved.getGpsStreamCheckedAt() != null),
                "treadmill run must be tombstoned after a latlng-less stream response");

        // Second sync: same unchanged run (duplicate, points still absent) -> no streams call.
        Activity imported = activityCaptor.getAllValues().get(0);
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_2001"))
                .thenReturn(Optional.of(imported));
        // The first sync advanced the cursor, so the second list call carries &after=.
        String secondSyncListUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1&after="
                + Math.max(0L, runner.getStravaListCursorEpoch() - 21600L);
        when(restTemplate.exchange(eq(secondSyncListUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("2001", "Treadmill Run", 5000d, 1500L))));
        clearInvocations(restTemplate);

        service.fetchAndSaveStravaActivities("token", 48L, true, "test_treadmill_second");

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, times(1)).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        assertEquals(1, urlCaptor.getAllValues().size());
        assertTrue(urlCaptor.getValue().contains("/athlete/activities"), "only the list call may happen");
        assertTrue(!urlCaptor.getValue().contains("/streams"), "no GPS stream call for tombstoned duplicate run");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(48L);
        assertEquals("COMPLETED", status.status());
        assertEquals(0, status.importedRuns());
        assertEquals(1, status.skippedDuplicates());
    }

    @Test
    void duplicateUnchangedRunSkipsStreamsFetch() {
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
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);

        Runner runner = new Runner();
        runner.setId(49L);
        when(runnerRepository.findById(49L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Activity existing = existingStravaRun(3001L, runner, "STRAVA_3001", "Morning Run", 5000d, 1500L);
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_3001"))
                .thenReturn(Optional.of(existing));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(false);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);

        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("3001", "Morning Run", 5000d, 1500L))));

        service.fetchAndSaveStravaActivities("token", 49L, true, "test_duplicate_gate");

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, times(1)).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        assertEquals(1, urlCaptor.getAllValues().size());
        assertTrue(urlCaptor.getValue().contains("/athlete/activities"), "only the list call may happen");
        assertTrue(!urlCaptor.getValue().contains("/streams"), "unchanged duplicate must not fetch streams");
        assertNull(existing.getGpsStreamState());

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(49L);
        assertEquals("COMPLETED", status.status());
        assertEquals(0, status.importedRuns());
        assertEquals(1, status.skippedDuplicates());
    }

    @Test
    void expiredTombstoneRetriesStreamFetchAndClearsAfterSave() {
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
        ReflectionTestUtils.setField(service, "noGpsRetryDays", 30);

        Runner runner = new Runner();
        runner.setId(50L);
        when(runnerRepository.findById(50L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Activity existing = existingStravaRun(3002L, runner, "STRAVA_3002", "Old Title", 5000d, 1500L);
        // Tombstone set 31 days ago: outside the 30-day retry window -> expired.
        existing.setGpsStreamState(Activity.GPS_STREAM_STATE_NO_GPS);
        existing.setGpsStreamCheckedAt(LocalDateTime.now().minusDays(31));
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_3002"))
                .thenReturn(Optional.of(existing));
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityPointRepository.existsByActivity(any(Activity.class))).thenReturn(false);
        when(acclimatizationService.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);

        // Title change makes the run NEW_OR_UPDATED so the streams gate is evaluated.
        when(restTemplate.exchange(bootstrapRecentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(stravaActivity("3002", "Corrected Title", 5000d, 1500L))));
        String streamsUrl = "https://www.strava.com/api/v3/activities/3002/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
        when(restTemplate.exchange(eq(streamsUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of(Map.of("type", "latlng", "data", List.of(List.of(40, -74))))));

        service.fetchAndSaveStravaActivities("token", 50L, true, "test_expired_tombstone");

        // Expired tombstone -> stream fetch retried, points saved, tombstone cleared.
        verify(restTemplate, times(1)).exchange(eq(streamsUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        verify(activityDataAccess).savePointsIfAbsentAtomically(eq(3002L), anyList());
        assertNull(existing.getGpsStreamState());
        assertNotNull(existing.getGpsStreamCheckedAt());

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(50L);
        assertEquals("COMPLETED", status.status());
        assertEquals(1, status.importedRuns());
    }

    @Test
    void cursorSmallerThanBufferClampsAfterToZero() {
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
        runner.setId(51L);
        runner.setStravaListCursorEpoch(1_000L); // far smaller than the 21,600s buffer
        when(runnerRepository.findById(51L)).thenReturn(Optional.of(runner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(List.of()));

        service.fetchAndSaveStravaActivities("token", 51L, true, "test_buffer_clamp");

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        verify(restTemplate, times(1)).exchange(urlCaptor.capture(), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef());
        assertTrue(urlCaptor.getValue().contains("after=0"),
                "cursor smaller than buffer must clamp after to 0, got: " + urlCaptor.getValue());

        verify(runnerRepository).save(any(Runner.class));
    }

    @Test
    void fullPageCapExitDoesNotAdvanceCursor() {
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
        ReflectionTestUtils.setField(service, "stravaRecentSyncMaxPages", 1);

        Runner runner = new Runner();
        runner.setId(52L);
        runner.setStravaListCursorEpoch(1_000_000L);
        when(runnerRepository.findById(52L)).thenReturn(Optional.of(runner));

        // A full 200-item page of non-runs: the loop exits by page cap with a full
        // page, so the window is not provably drained.
        List<Map<String, Object>> fullPage = new ArrayList<>();
        for (int index = 0; index < 200; index++) {
            fullPage.add(Map.of(
                    "id", "ride-" + index,
                    "sport_type", "Ride",
                    "type", "Ride",
                    "name", "Ride " + index,
                    "distance", 10_000d,
                    "moving_time", 600L,
                    "start_date_local", "2026-07-01T06:00:00Z"
            ));
        }
        // cursor 1,000,000 minus the default 21,600s buffer -> after=978400
        String pageOneUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1&after=978400";
        when(restTemplate.exchange(eq(pageOneUrl), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(fullPage));

        service.fetchAndSaveStravaActivities("token", 52L, true, "test_full_page_cap");

        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(52L);
        assertEquals("COMPLETED", status.status());
        assertEquals(1, status.processedPages());
        assertEquals(200, status.skippedNonRuns());
        verify(runnerRepository, never()).save(any(Runner.class));
        assertEquals(1_000_000L, runner.getStravaListCursorEpoch());
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
