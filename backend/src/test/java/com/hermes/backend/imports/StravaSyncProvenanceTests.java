package com.hermes.backend.imports;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.DeletedActivityTombstoneRepository;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.billing.AiUsageService;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.weather.AcclimatizationService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** What the Strava sync does about provenance, deleted runs, disconnects and revoked access. */
class StravaSyncProvenanceTests {

    private ActivityRepository activityRepository;
    private RunnerRepository runnerRepository;
    private RestTemplate restTemplate;
    private StravaTokenService stravaTokenService;
    private ActivityDataAccess activityDataAccess;
    private AutomatedCoachService coach;
    private StravaSyncService service;
    private Runner runner;

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static HttpEntity<?> anyHttpEntity() {
        return (HttpEntity) any(HttpEntity.class);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static <T> ParameterizedTypeReference<T> anyTypeRef() {
        return (ParameterizedTypeReference) any(ParameterizedTypeReference.class);
    }

    private static String recentPage(int page) {
        String prefix = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=" + page + "&after=";
        return argThat(url -> url != null && url.startsWith(prefix));
    }

    private static Map<String, Object> stravaRun(String id) {
        return Map.of(
                "id", Long.parseLong(id),
                "name", "Run " + id,
                "type", "Run",
                "sport_type", "Run",
                "distance", 5000d,
                "moving_time", 1500L,
                "start_date_local", "2026-10-01T08:00:00Z"
        );
    }

    private static HttpClientErrorException unauthorized() {
        return HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", new HttpHeaders(),
                new byte[0], StandardCharsets.UTF_8);
    }

    @BeforeEach
    void setUp() {
        activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository points = mock(ActivityPointRepository.class);
        runnerRepository = mock(RunnerRepository.class);
        restTemplate = mock(RestTemplate.class);
        AcclimatizationService acclimatization = mock(AcclimatizationService.class);
        coach = mock(AutomatedCoachService.class);
        stravaTokenService = mock(StravaTokenService.class);
        activityDataAccess = mock(ActivityDataAccess.class);
        service = new StravaSyncService(activityRepository, points, runnerRepository, restTemplate, acclimatization,
                coach, mock(ApplicationEventPublisher.class), mock(AiUsageService.class), stravaTokenService, activityDataAccess);

        runner = new Runner();
        runner.setId(41L);
        when(runnerRepository.findById(41L)).thenReturn(Optional.of(runner));
        when(activityRepository.save(any(Activity.class))).thenAnswer(call -> call.getArgument(0));
        when(points.existsByActivity(any(Activity.class))).thenReturn(true);
        when(acclimatization.calculatePenaltyForActivity(any(Activity.class))).thenReturn(0);
    }

    private void listReturns(List<Map<String, Object>> page) {
        when(restTemplate.exchange(recentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(page));
    }

    @Test
    void everyRunTheSyncStoresIsFlaggedAsStravaApiSourced() {
        listReturns(List.of(stravaRun("1001")));

        service.fetchAndSaveStravaActivities("token", 41L, true, "test");

        ArgumentCaptor<Activity> saved = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues()).isNotEmpty().allMatch(Activity::isStravaApiSourced);
        assertThat(saved.getValue().getProvider()).isEqualTo(ImportProvider.STRAVA);
    }

    @Test
    void aRunTheRunnerDeletedInHermesIsNotBroughtBack() {
        DeletedActivityTombstoneRepository tombstones = mock(DeletedActivityTombstoneRepository.class);
        when(tombstones.existsByRunnerAndProviderAndExternalId(runner, "STRAVA", "1001")).thenReturn(true);
        service.setDeletedActivityTombstones(tombstones);
        listReturns(List.of(stravaRun("1001")));

        service.fetchAndSaveStravaActivities("token", 41L, true, "test");

        verify(activityRepository, never()).save(any(Activity.class));
        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(41L);
        assertThat(status.importedRuns()).isZero();
        assertThat(status.skippedDuplicates()).isEqualTo(1);
    }

    @Test
    void aRunWithoutATombstoneIsStillImported() {
        DeletedActivityTombstoneRepository tombstones = mock(DeletedActivityTombstoneRepository.class);
        service.setDeletedActivityTombstones(tombstones);
        listReturns(List.of(stravaRun("1002")));

        service.fetchAndSaveStravaActivities("token", 41L, true, "test");

        assertThat(service.snapshotSyncStatus(41L).importedRuns()).isEqualTo(1);
    }

    @Test
    void aSyncStopsAtTheNextRunWhenTheRunnerDisconnects() {
        when(activityRepository.save(any(Activity.class))).thenAnswer(call -> {
            service.onStravaAccountUnlinked(new StravaAccountUnlinkedEvent(41L));
            return call.getArgument(0);
        });
        listReturns(List.of(stravaRun("1001"), stravaRun("1002"), stravaRun("1003")));

        service.fetchAndSaveStravaActivities("token", 41L, true, "test");

        verify(activityRepository, times(1)).save(any(Activity.class));
        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(41L);
        assertThat(status.status()).isEqualTo("FAILED");
        assertThat(status.error()).isEqualTo("Strava was disconnected.");
    }

    @Test
    void aConfirmedRevocationPurgesAndSaysSo() {
        StravaAccountService accounts = mock(StravaAccountService.class);
        service.setStravaAccountService(accounts);
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("same-token");
        when(restTemplate.exchange(recentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef())).thenThrow(unauthorized());
        when(accounts.confirmRevocationAndPurge(41L)).thenReturn(StravaAccountService.RevocationOutcome.PURGED);

        service.fetchAndSaveStravaActivities("same-token", 41L, true, "test");

        verify(accounts).confirmRevocationAndPurge(41L);
        StravaSyncService.StravaSyncStatusResponse status = service.snapshotSyncStatus(41L);
        assertThat(status.status()).isEqualTo("FAILED");
        assertThat(status.error()).startsWith("Strava access was revoked");
    }

    @Test
    void anUnconfirmedRevocationKeepsTheOldRelinkMessageAndDeletesNothing() {
        for (StravaAccountService.RevocationOutcome outcome : List.of(
                StravaAccountService.RevocationOutcome.STILL_AUTHORIZED,
                StravaAccountService.RevocationOutcome.INCONCLUSIVE,
                StravaAccountService.RevocationOutcome.NOT_LINKED)) {
            StravaAccountService accounts = mock(StravaAccountService.class);
            service.setStravaAccountService(accounts);
            when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("same-token");
            when(restTemplate.exchange(recentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef())).thenThrow(unauthorized());
            when(accounts.confirmRevocationAndPurge(41L)).thenReturn(outcome);

            service.fetchAndSaveStravaActivities("same-token", 41L, true, "test");

            assertThat(service.snapshotSyncStatus(41L).error())
                    .as(outcome.name())
                    .isEqualTo("Strava authorization expired. Please relink your Strava account.");
            verify(activityDataAccess, never()).purgeActivities(any(), any());
        }
    }

    @Test
    void anExpiredButRefreshableTokenDoesNotTriggerARevocationCheck() {
        StravaAccountService accounts = mock(StravaAccountService.class);
        service.setStravaAccountService(accounts);
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("fresh-token");
        when(restTemplate.exchange(recentPage(1), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(unauthorized())
                .thenReturn(ResponseEntity.ok(List.of()));

        service.fetchAndSaveStravaActivities("stale-token", 41L, true, "test");

        verify(accounts, never()).confirmRevocationAndPurge(any());
        assertThat(service.snapshotSyncStatus(41L).status()).isEqualTo("COMPLETED");
    }

    // --- webhook delete hints --------------------------------------------------------------------------------

    private Activity existingRun(long id, String stravaId) {
        Activity run = new Activity();
        run.setId(id);
        run.setRunner(runner);
        run.setProvider(ImportProvider.STRAVA);
        run.setStravaId(stravaId);
        run.setSourceChecksum("STRAVA_" + stravaId);
        return run;
    }

    @Test
    void aDeleteHintDeletesOnlyWhenStravaSaysTheActivityIsGone() {
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("token");
        when(restTemplate.exchange(eq("https://www.strava.com/api/v3/activities/55"), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(HttpClientErrorException.create(HttpStatus.NOT_FOUND, "Not Found", new HttpHeaders(), new byte[0], StandardCharsets.UTF_8));
        when(activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, "STRAVA_55"))
                .thenReturn(Optional.of(existingRun(5L, "55")));

        boolean deleted = service.deleteStravaActivityIfGone(runner, 55L);

        assertThat(deleted).isTrue();
        verify(activityDataAccess).purgeActivities(runner, List.of(5L));
        verify(coach).reaggregateRunner(41L);
    }

    @Test
    void aDeleteHintForAnActivityThatStillExistsChangesNothing() {
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("token");
        when(restTemplate.exchange(eq("https://www.strava.com/api/v3/activities/55"), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenReturn(ResponseEntity.ok(Map.of("id", 55)));

        assertThat(service.deleteStravaActivityIfGone(runner, 55L)).isFalse();
        verify(activityDataAccess, never()).purgeActivities(any(), any());
    }

    @Test
    void aDeleteHintThatCannotBeConfirmedChangesNothing() {
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("token");
        when(restTemplate.exchange(eq("https://www.strava.com/api/v3/activities/55"), eq(HttpMethod.GET), anyHttpEntity(), anyTypeRef()))
                .thenThrow(HttpServerErrorException.create(HttpStatus.BAD_GATEWAY, "Bad Gateway", new HttpHeaders(), new byte[0], StandardCharsets.UTF_8));

        assertThat(service.deleteStravaActivityIfGone(runner, 55L)).isFalse();
        verify(activityDataAccess, never()).purgeActivities(any(), any());
    }

    @Test
    void aDeleteHintWithoutAUsableTokenChangesNothing() {
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn(null);

        assertThat(service.deleteStravaActivityIfGone(runner, 55L)).isFalse();
        verify(restTemplate, never()).exchange(any(String.class), any(HttpMethod.class), any(), any(ParameterizedTypeReference.class));
        verify(activityDataAccess, never()).purgeActivities(any(), any());
    }
}
