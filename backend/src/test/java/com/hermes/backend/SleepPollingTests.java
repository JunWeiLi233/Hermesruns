package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SleepPollingTests {
    private final RunnerRepository runners = mock(RunnerRepository.class);
    private final StravaTokenService tokens = mock(StravaTokenService.class);
    private final StravaSyncService strava = mock(StravaSyncService.class);
    private final GarminWellnessImportService garmin = mock(GarminWellnessImportService.class);
    private final SecretEncryptionService encryption = mock(SecretEncryptionService.class);
    private final AdminBackgroundJobService jobs = mock(AdminBackgroundJobService.class);

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withBean(RunnerRepository.class, () -> runners)
            .withBean(StravaTokenService.class, () -> tokens)
            .withBean(StravaSyncService.class, () -> strava)
            .withBean(GarminWellnessImportService.class, () -> garmin)
            .withBean(SecretEncryptionService.class, () -> encryption)
            .withBean(AdminBackgroundJobService.class, () -> jobs)
            .withBean(StravaAutoSyncScheduler.class)
            .withBean(GarminWellnessSyncScheduler.class);

    @Test
    void disabledPollingTouchesNoDatabaseProviderOrJobService() {
        context.withPropertyValues("app.background.polling.enabled=false").run(ctx -> {
            // Startup recovery may use the job bean; measure only scheduled polling here.
            clearInvocations(runners, tokens, strava, garmin, encryption, jobs);
            ctx.getBean(StravaAutoSyncScheduler.class).syncAllStravaRunners();
            ctx.getBean(GarminWellnessSyncScheduler.class).syncAllGarminWellnessRunners();
            verifyNoInteractions(runners, tokens, strava, garmin, encryption, jobs);
        });
    }

    @Test
    void disabledPollingDoesNotDisableManualDispatch() {
        AdminBackgroundJob job = new AdminBackgroundJob();
        when(tokens.isStravaConfigured()).thenReturn(true);
        when(runners.findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse())
                .thenReturn(List.of());
        when(runners.findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse())
                .thenReturn(List.of());
        when(jobs.createJob(anyString(), anyString(), isNull(), anyString(), anyMap())).thenReturn(job);

        context.withPropertyValues("app.background.polling.enabled=false").run(ctx -> {
            assertThat(ctx.getBean(StravaAutoSyncScheduler.class).triggerAdminSync(null, "manual_test"))
                    .isSameAs(job);
            assertThat(ctx.getBean(GarminWellnessSyncScheduler.class).triggerAdminSync(null, "manual_test"))
                    .isSameAs(job);
            verify(runners).findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse();
            verify(runners).findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse();
        });
    }

    @Test
    void pollingRemainsEnabledByDefault() {
        context.run(ctx -> {
            ctx.getBean(StravaAutoSyncScheduler.class).syncAllStravaRunners();
            ctx.getBean(GarminWellnessSyncScheduler.class).syncAllGarminWellnessRunners();
            verify(tokens).isStravaConfigured();
            verify(runners).findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse();
        });
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"20,21", "200,90", "2,7", "-2,7"})
    void garminWakeCatchUpCoversPersistedGapWithinBootstrapBound(int daysAgo, int expectedDays) {
        Runner runner = new Runner();
        runner.setId(73L);
        runner.setGarminConnectEmail("runner@example.test");
        runner.setGarminConnectPasswordEncrypted("test-encrypted");
        runner.setGarminWellnessLastSyncedAt(java.time.LocalDateTime.now().minusDays(daysAgo));
        AdminBackgroundJob job = new AdminBackgroundJob();
        when(runners.findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse())
                .thenReturn(List.of(runner));
        when(encryption.decrypt("test-encrypted")).thenReturn("test-password");
        when(jobs.createJob(anyString(), anyString(), isNull(), anyString(), anyMap())).thenReturn(job);
        doAnswer(invocation -> { invocation.<Runnable>getArgument(2).run(); return null; })
                .when(jobs).runAsync(eq(job), eq(1), any(Runnable.class));
        when(garmin.importWellnessNow(eq(runner), anyString(), anyString(), anyInt())).thenReturn(true);

        context.withPropertyValues("app.background.polling.enabled=false").run(ctx -> {
            ctx.getBean(GarminWellnessSyncScheduler.class).syncOnWake();
            verify(garmin).importWellnessNow(runner, "runner@example.test", "test-password", expectedDays);
            verify(runners).recordGarminWellnessSyncSuccess(eq(runner.getId()), any());
            verify(runners, never()).save(any());
            verify(jobs, never()).runAsync(any(), anyInt(), any());
        });
    }

    @Test
    void failedGarminCatchUpRetainsTheGapForTheNextWake() {
        Runner runner = new Runner();
        runner.setId(73L);
        runner.setGarminConnectEmail("runner@example.test");
        runner.setGarminConnectPasswordEncrypted("test-encrypted");
        var previous = java.time.LocalDateTime.now().minusDays(20);
        runner.setGarminWellnessLastSyncedAt(previous);
        when(runners.findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse())
                .thenReturn(List.of(runner));
        when(encryption.decrypt("test-encrypted")).thenReturn("test-password");
        when(jobs.createJob(anyString(), anyString(), isNull(), anyString(), anyMap()))
                .thenReturn(new AdminBackgroundJob());
        when(garmin.importWellnessNow(eq(runner), anyString(), anyString(), eq(21))).thenReturn(false);

        context.run(ctx -> {
            var scheduler = ctx.getBean(GarminWellnessSyncScheduler.class);
            scheduler.syncOnWake();
            scheduler.syncOnWake();
            verify(garmin, times(2)).importWellnessNow(runner, "runner@example.test", "test-password", 21);
            verify(runners, never()).recordGarminWellnessSyncSuccess(any(), any());
            verify(runners, never()).save(any());
            assertThat(runner.getGarminWellnessLastSyncedAt()).isEqualTo(previous);
        });
    }

    @Test
    void stravaWakeWaitsForImportInsteadOfDispatchingAnotherWorker() {
        Runner runner = new Runner();
        runner.setId(73L);
        when(tokens.isStravaConfigured()).thenReturn(true);
        when(tokens.resolveRunnerStravaAccessToken(runner)).thenReturn("test-token");
        when(runners.findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse())
                .thenReturn(List.of(runner));
        when(jobs.createJob(anyString(), anyString(), isNull(), anyString(), anyMap()))
                .thenReturn(new AdminBackgroundJob());
        context.run(ctx -> {
            ctx.getBean(StravaAutoSyncScheduler.class).syncOnWake();
            verify(strava).fetchAndSaveStravaActivities("test-token", 73L, true, "scheduled_recent_sync");
            verify(jobs, never()).runAsync(any(), anyInt(), any());
        });
    }
}
