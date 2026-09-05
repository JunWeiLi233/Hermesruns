package com.hermes.backend.imports;

import com.hermes.backend.admin.AdminBackgroundJob;
import com.hermes.backend.admin.AdminBackgroundJobService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StravaAutoSyncSchedulerTests {

    @Test
    void scheduledSyncMarksRunnerFailedWhenTrackerEndsFailed() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaTokenService stravaTokenService = mock(StravaTokenService.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        AdminBackgroundJobService adminBackgroundJobService = mock(AdminBackgroundJobService.class);
        StravaAutoSyncScheduler scheduler = new StravaAutoSyncScheduler(
                runnerRepository,
                stravaTokenService,
                stravaSyncService,
                adminBackgroundJobService
        );
        ReflectionTestUtils.setField(scheduler, "syncEnabled", true);

        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@test.local");
        runner.setStravaAthleteId(123456L);
        runner.setStravaRefreshToken("refresh-token");

        AdminBackgroundJob job = new AdminBackgroundJob();
        when(stravaTokenService.isStravaConfigured()).thenReturn(true);
        when(runnerRepository.findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse())
                .thenReturn(List.of(runner));
        when(adminBackgroundJobService.createJob(eq("STRAVA_GLOBAL_SYNC"), eq("scheduler"), isNull(), anyString(), anyMap()))
                .thenReturn(job);
        doAnswer(invocation -> {
            Runnable task = invocation.getArgument(2);
            task.run();
            return null;
        }).when(adminBackgroundJobService).runAsync(eq(job), eq(1), any(Runnable.class));
        when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("access-token");
        when(stravaSyncService.snapshotSyncStatus(7L)).thenReturn(new StravaSyncService.StravaSyncStatusResponse(
                "FAILED",
                0,
                0,
                0,
                0,
                0,
                "Strava application is inactive. Reactivate the Strava API app or update the credentials, then reconnect Strava.",
                false,
                "scheduled_recent_sync",
                true,
                Instant.now().toString()
        ));

        scheduler.syncAllStravaRunners();

        @SuppressWarnings("rawtypes")
        ArgumentCaptor<Map> detailsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(stravaSyncService).fetchAndSaveStravaActivities("access-token", 7L, true, "scheduled_recent_sync");
        verify(adminBackgroundJobService).markCompleted(
                eq(job),
                eq(0),
                eq(1),
                eq("Global Strava sync finished with 1 failure."),
                detailsCaptor.capture()
        );
        assertThat(String.valueOf(detailsCaptor.getValue().get("failures")))
                .contains("runner@test.local")
                .contains("Strava application is inactive");
    }

    /**
     * Wires a scheduler with one Strava-linked runner whose sync completes with the
     * given status; runAsync executes synchronously so backoff decisions are
     * observable without sleeping. All time is driven via ReflectionTestUtils.
     */
    private static final class SchedulerHarness {
        final RunnerRepository runnerRepository = mock(RunnerRepository.class);
        final StravaTokenService stravaTokenService = mock(StravaTokenService.class);
        final StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        final AdminBackgroundJobService adminBackgroundJobService = mock(AdminBackgroundJobService.class);
        final StravaAutoSyncScheduler scheduler;
        final Runner runner = new Runner();
        final AdminBackgroundJob job = new AdminBackgroundJob();
        boolean importedActivity;

        SchedulerHarness(String runnerSyncStatus, boolean importedActivity) {
            this.scheduler = new StravaAutoSyncScheduler(
                    runnerRepository,
                    stravaTokenService,
                    stravaSyncService,
                    adminBackgroundJobService
            );
            this.importedActivity = importedActivity;
            ReflectionTestUtils.setField(scheduler, "syncEnabled", true);
            ReflectionTestUtils.setField(scheduler, "baseIntervalMs", 600_000L);
            ReflectionTestUtils.setField(scheduler, "backoffMaxMinutes", 60L);

            runner.setId(7L);
            runner.setEmail("runner@test.local");
            runner.setStravaAthleteId(123456L);
            runner.setStravaRefreshToken("refresh-token");

            when(stravaTokenService.isStravaConfigured()).thenReturn(true);
            when(runnerRepository.findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse())
                    .thenReturn(List.of(runner));
            when(adminBackgroundJobService.createJob(eq("STRAVA_GLOBAL_SYNC"), anyString(), isNull(), anyString(), anyMap()))
                    .thenReturn(job);
            doAnswer(invocation -> {
                Runnable task = invocation.getArgument(2);
                task.run();
                return null;
            }).when(adminBackgroundJobService).runAsync(eq(job), eq(1), any(Runnable.class));
            when(stravaTokenService.resolveRunnerStravaAccessToken(runner)).thenReturn("access-token");
            when(stravaSyncService.snapshotSyncStatus(7L)).thenReturn(new StravaSyncService.StravaSyncStatusResponse(
                    runnerSyncStatus,
                    0,
                    0,
                    0,
                    0,
                    0,
                    "FAILED".equals(runnerSyncStatus) ? "Strava rate limit reached. Try again later." : null,
                    false,
                    "scheduled_recent_sync",
                    true,
                    Instant.now().toString()
            ));
            when(stravaSyncService.hasImportedActivitySince(anyLong()))
                    .thenAnswer(invocation -> this.importedActivity);
        }

        long currentIntervalMs() {
            return (long) ReflectionTestUtils.getField(scheduler, "currentIntervalMs");
        }

        long lastSyncRanAtMs() {
            return (long) ReflectionTestUtils.getField(scheduler, "lastSyncRanAtMs");
        }
    }

    @Test
    void quietCycleDoublesIntervalUpToTheMax() {
        SchedulerHarness harness = new SchedulerHarness("COMPLETED", false);

        // Cycle 1 (base 10 min): quiet -> doubles to 20 min.
        harness.scheduler.syncAllStravaRunners();
        assertThat(harness.currentIntervalMs()).isEqualTo(1_200_000L);
        assertThat(harness.lastSyncRanAtMs()).isPositive();

        // An immediate tick inside the effective interval is skipped (no new job).
        harness.scheduler.syncAllStravaRunners();
        verify(harness.adminBackgroundJobService, times(1))
                .createJob(eq("STRAVA_GLOBAL_SYNC"), anyString(), isNull(), anyString(), anyMap());

        // Cycle 2 (simulate elapsed time): 20 -> 40 min.
        ReflectionTestUtils.setField(harness.scheduler, "lastSyncRanAtMs", 0L);
        harness.scheduler.syncAllStravaRunners();
        assertThat(harness.currentIntervalMs()).isEqualTo(2_400_000L);

        // Cycle 3: 40 min would double to 80 min but is capped at 60 min.
        ReflectionTestUtils.setField(harness.scheduler, "lastSyncRanAtMs", 0L);
        harness.scheduler.syncAllStravaRunners();
        assertThat(harness.currentIntervalMs()).isEqualTo(3_600_000L);
        verify(harness.adminBackgroundJobService, times(3))
                .createJob(eq("STRAVA_GLOBAL_SYNC"), anyString(), isNull(), anyString(), anyMap());
    }

    @Test
    void cycleWithImportedActivityResetsBackoffToBaseInterval() {
        SchedulerHarness harness = new SchedulerHarness("COMPLETED", true);
        ReflectionTestUtils.setField(harness.scheduler, "currentIntervalMs", 2_400_000L);
        ReflectionTestUtils.setField(harness.scheduler, "lastSyncRanAtMs", 0L);

        harness.scheduler.syncAllStravaRunners();

        assertThat(harness.currentIntervalMs()).isEqualTo(600_000L);
    }

    @Test
    void cycleWithFailureResetsBackoffToBaseInterval() {
        SchedulerHarness harness = new SchedulerHarness("FAILED", false);
        ReflectionTestUtils.setField(harness.scheduler, "currentIntervalMs", 2_400_000L);
        ReflectionTestUtils.setField(harness.scheduler, "lastSyncRanAtMs", 0L);

        harness.scheduler.syncAllStravaRunners();

        assertThat(harness.currentIntervalMs()).isEqualTo(600_000L);
    }

    @Test
    void triggerAdminSyncBypassesAdaptiveBackoff() {
        // Start quiet so the scheduled cycle backs off.
        SchedulerHarness harness = new SchedulerHarness("COMPLETED", false);

        harness.scheduler.syncAllStravaRunners();
        assertThat(harness.currentIntervalMs()).isEqualTo(1_200_000L);
        assertThat(harness.lastSyncRanAtMs()).isPositive();

        // The manual sync finds something new (e.g. a missed webhook gap).
        harness.importedActivity = true;

        // Manual admin trigger fires immediately despite the recent quiet cycle.
        harness.scheduler.triggerAdminSync(null, null);

        verify(harness.adminBackgroundJobService, times(2))
                .createJob(eq("STRAVA_GLOBAL_SYNC"), anyString(), isNull(), anyString(), anyMap());
        verify(harness.adminBackgroundJobService).createJob(
                eq("STRAVA_GLOBAL_SYNC"), eq("admin_manual"), isNull(), anyString(), anyMap());
        // Interval restarts from the base (not from the backed-off value), and the
        // backoff clock is reset so the next scheduled tick may run immediately.
        assertThat(harness.currentIntervalMs()).isEqualTo(600_000L);
        assertThat(harness.lastSyncRanAtMs()).isZero();
    }
}
