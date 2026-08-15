package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
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
}
