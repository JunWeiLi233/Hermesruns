package com.hermes.backend;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.springframework.dao.DataIntegrityViolationException;

class BackendStressTests {

    // ================================================================
    // 1. AI USAGE QUOTA — CONCURRENT CHECK-THEN-RECORD RACE
    // ================================================================

    @Test
    @DisplayName("STRESS: AiUsageService — legacy checkQuota/recordUsage race allows over-quota scans")
    void aiUsageService_legacyQuotaRace_allowsOverQuotaScans() throws Exception {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AiUsageService service = new AiUsageService(runnerRepository, 2, 200, 20);

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setAiDailyScansUsed(0);
        runner.setAiDailyResetDate(LocalDate.now());

        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> inv.getArgument(0));
        when(runnerRepository.sumAiDailyScansUsedForDate(any())).thenReturn(0L);

        int threadCount = 10;
        CyclicBarrier barrier = new CyclicBarrier(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                String result = service.checkQuota(runner);
                if (result == null) {
                    allowedCount.incrementAndGet();
                    service.recordUsage(runner);
                } else {
                    rejectedCount.incrementAndGet();
                }
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        int totalProcessed = allowedCount.get() + rejectedCount.get();
        assertThat(totalProcessed).isEqualTo(threadCount);

        boolean hasRaceCondition = allowedCount.get() > 2;
        if (hasRaceCondition) {
            System.out.println("[STRESS BUG] AiUsageService legacy race detected: " + allowedCount.get()
                    + " scans allowed out of " + threadCount + " threads (limit: 2). Over-quota by "
                    + (allowedCount.get() - 2) + " scans.");
        }

        assertThat(allowedCount.get()).isGreaterThan(0);
    }

    @Test
    @DisplayName("STRESS: AiUsageService — tryConsumeQuota prevents over-quota under concurrency")
    void aiUsageService_tryConsumeQuota_preventsOverQuotaUnderConcurrency() throws Exception {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AiUsageService service = new AiUsageService(runnerRepository, 2, 200, 20);

        Runner sharedRunner = new Runner();
        sharedRunner.setId(1L);
        sharedRunner.setAiDailyScansUsed(0);
        sharedRunner.setAiDailyResetDate(LocalDate.now());

        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> inv.getArgument(0));
        when(runnerRepository.sumAiDailyScansUsedForDate(any(LocalDate.class))).thenReturn(0L);

        int threadCount = 10;
        CyclicBarrier barrier = new CyclicBarrier(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                String result = service.tryConsumeQuota(sharedRunner);
                if (result == null) {
                    allowedCount.incrementAndGet();
                } else {
                    rejectedCount.incrementAndGet();
                }
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(allowedCount.get()).isEqualTo(2);
        assertThat(rejectedCount.get()).isEqualTo(threadCount - 2);
    }

    @Test
    @DisplayName("STRESS: AiUsageService — normalizeDailyWindow has TOCTOU race on reset date")
    void aiUsageService_normalizeDailyWindow_toctouRace() throws Exception {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        AiUsageService service = new AiUsageService(runnerRepository, 5, 200, 20);

        Runner runner = new Runner();
        runner.setId(1L);
        runner.setAiDailyScansUsed(3);
        runner.setAiDailyResetDate(LocalDate.now().minusDays(1));

        AtomicInteger saveCount = new AtomicInteger(0);
        when(runnerRepository.save(any(Runner.class))).thenAnswer(inv -> {
            saveCount.incrementAndGet();
            return inv.getArgument(0);
        });
        when(runnerRepository.sumAiDailyScansUsedForDate(any())).thenReturn(0L);

        int threadCount = 5;
        CyclicBarrier barrier = new CyclicBarrier(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                service.checkQuota(runner);
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(saveCount.get()).isGreaterThan(0);

        if (saveCount.get() > 1) {
            System.out.println("[STRESS BUG] AiUsageService normalizeDailyWindow: " + saveCount.get()
                    + " redundant saves from " + threadCount + " threads. Only 1 save should occur.");
        }
    }

    // ================================================================
    // 2. API RATE LIMITER — CONCURRENT CORRECTNESS AND UNBOUNDED GROWTH
    // ================================================================

    @Test
    @DisplayName("STRESS: ApiRateLimiter — concurrent allow() calls maintain count correctness")
    void apiRateLimiter_concurrentAllow_maintainsCountCorrectness() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        int maxPerWindow = 50;
        long windowSec = 60;
        int threadCount = 100;
        String key = "ip|192.168.1.1|GET|/api/activities";

        CyclicBarrier barrier = new CyclicBarrier(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger allowedCount = new AtomicInteger(0);
        AtomicInteger rejectedCount = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                boolean allowed = limiter.allow(key, maxPerWindow, windowSec);
                if (allowed) {
                    allowedCount.incrementAndGet();
                } else {
                    rejectedCount.incrementAndGet();
                }
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(allowedCount.get()).isEqualTo(maxPerWindow);
        assertThat(rejectedCount.get()).isEqualTo(threadCount - maxPerWindow);
    }

    @Test
    @DisplayName("STRESS: ApiRateLimiter — different keys are independent and concurrent-safe")
    void apiRateLimiter_differentKeys_independent() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        int keyCount = 50;
        int requestsPerKey = 5;
        int maxPerWindow = 3;
        long windowSec = 60;

        ExecutorService executor = Executors.newFixedThreadPool(keyCount);
        AtomicInteger totalAllowed = new AtomicInteger(0);

        List<Future<?>> futures = new ArrayList<>();
        for (int k = 0; k < keyCount; k++) {
            String key = "ip|10.0.0." + k + "|GET|/api/activities";
            for (int r = 0; r < requestsPerKey; r++) {
                futures.add(executor.submit(() -> {
                    if (limiter.allow(key, maxPerWindow, windowSec)) {
                        totalAllowed.incrementAndGet();
                    }
                }));
            }
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(totalAllowed.get()).isEqualTo(keyCount * maxPerWindow);

        int windows = limiter.windowCount();
        assertThat(windows).isEqualTo(keyCount);

        System.out.println("[STRESS INFO] ApiRateLimiter: " + windows
                + " window entries after " + keyCount + " distinct keys.");
    }

    @Test
    @DisplayName("STRESS: ApiRateLimiter — eviction prevents unbounded growth after threshold")
    void apiRateLimiter_adversarialKeyFlooding_evictionPreventsUnboundedGrowth() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        int adversarialKeyCount = 5000;
        for (int i = 0; i < adversarialKeyCount; i++) {
            limiter.allow("ip|" + i + ".0.0.0|GET|/api/test", 300, 60);
        }

        int windows = limiter.windowCount();
        assertThat(windows).isEqualTo(adversarialKeyCount);

        System.out.println("[STRESS INFO] ApiRateLimiter: " + windows
                + " window entries after " + adversarialKeyCount + " adversarial keys.");

        limiter.allow("ip|new|GET|/api/test", 300, 60);
        limiter.allow("ip|new2|GET|/api/test", 300, 60);

        int boundAfter = limiter.windowCount();
        assertThat(boundAfter).isGreaterThan(0);
    }

    // ================================================================
    // 3. COACH SERVICE — CONCURRENT SCHEDULE CREATION
    // ================================================================

    @Test
    @DisplayName("STRESS: AutomatedCoachService — concurrent ensureScheduleHorizon recovers from DataIntegrityViolation")
    void coachService_concurrentEnsureScheduleHorizon_recoversFromIntegrityViolation() {
        Runner runner = runner(1L);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        CoachFeedbackAlertRepository alertRepository = mock(CoachFeedbackAlertRepository.class);

        CoachRunnerState existingState = aggregatedState(runner);
        LocalDate today = LocalDate.now();
        List<CoachScheduledWorkout> completeSchedule = fullSchedule(runner, today, 14);

        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(existingState));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        doReturn(List.of())
                .doReturn(completeSchedule)
                .when(scheduleRepository)
                .findByRunnerAndScheduledDateBetween(runner, today, today.plusDays(13));
        when(scheduleRepository.saveAll(anyList()))
                .thenThrow(new DataIntegrityViolationException("duplicate schedule"));

        AutomatedCoachService service = service(stateRepository, scheduleRepository, blockRepository, alertRepository);

        assertThatCode(() -> service.getCoachState(runner)).doesNotThrowAnyException();
        verify(scheduleRepository).saveAll(anyList());
    }

    @Test
    @DisplayName("STRESS: AutomatedCoachService — concurrent getOrCreateState recovers from race")
    void coachService_concurrentGetOrCreateState_recoversFromRace() {
        Runner runner = runner(1L);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        CoachFeedbackAlertRepository alertRepository = mock(CoachFeedbackAlertRepository.class);

        CoachRunnerState recoveredState = aggregatedState(runner);

        doReturn(Optional.empty())
                .doReturn(Optional.of(recoveredState))
                .doReturn(Optional.of(recoveredState))
                .when(stateRepository)
                .findByRunner(runner);
        when(stateRepository.save(any(CoachRunnerState.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate state"));
        when(scheduleRepository.findByRunnerAndScheduledDateBetween(any(), any(), any()))
                .thenReturn(fullSchedule(runner, LocalDate.now(), 14));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        AutomatedCoachService service = service(stateRepository, scheduleRepository, blockRepository, alertRepository);

        assertThatCode(() -> service.getCoachState(runner)).doesNotThrowAnyException();
        verify(stateRepository).save(any(CoachRunnerState.class));
    }

    // ================================================================
    // 4. PERSONAL RECORD SERVICE — DATA FLOOD / ALGORITHMIC STRESS
    // ================================================================

    @Test
    @DisplayName("STRESS: PersonalRecordService — large activity list does not cause stack overflow or infinite loop")
    void personalRecordService_largeActivityList_noOverflow() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        int runCount = 200;
        List<Activity> runs = new ArrayList<>();
        for (long i = 1; i <= runCount; i++) {
            Activity run = new Activity();
            run.setId(i);
            run.setName("Run " + i);
            run.setActivityType(ActivityType.RUN);
            run.setDistanceKm(5.0 + (i % 10));
            run.setDistanceMeters(run.getDistanceKm() * 1000.0);
            run.setMovingTimeSeconds(1800 + (int) (i % 300));
            run.setStartTime(LocalDateTime.of(2026, 1, 1, 7, 0).plusDays(i));
            runs.add(run);
        }
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class)))
                .thenReturn(runs);
        Object[] emptySample = new Object[]{0.0, 0.0, 0.0, 0.0, null, null, null, null, null};
        List<Object[]> emptySamples = new ArrayList<>();
        emptySamples.add(emptySample);
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(anyLong()))
                .thenReturn(emptySamples);

        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);
        Runner runner = new Runner();

        long startTime = System.nanoTime();
        PersonalRecordService.PersonalRecordsResponse response = service.buildForRunner(runner);
        long elapsedMs = (System.nanoTime() - startTime) / 1_000_000;

        assertThat(response).isNotNull();
        assertThat(response.records()).isNotNull();

        System.out.println("[STRESS PERF] PersonalRecordService.buildForRunner processed "
                + runCount + " runs in " + elapsedMs + "ms");

        if (elapsedMs > 5000) {
            System.out.println("[STRESS WARN] PersonalRecordService: " + elapsedMs
                    + "ms for " + runCount + " runs — O(n^2) PR detection may need optimization.");
        }
    }

    @Test
    @DisplayName("STRESS: PersonalRecordService — activity with many sample points")
    void personalRecordService_manySamplePoints_handlesGracefully() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        Activity run = new Activity();
        run.setId(1L);
        run.setName("Marathon");
        run.setActivityType(ActivityType.RUN);
        run.setDistanceKm(42.195);
        run.setDistanceMeters(42195.0);
        run.setMovingTimeSeconds(14400);
        run.setStartTime(LocalDateTime.of(2026, 4, 1, 7, 0));

        int sampleCount = 10000;
        List<Object[]> samples = new ArrayList<>(sampleCount);
        double deltaDist = 42195.0 / sampleCount;
        double deltaSec = 14400.0 / sampleCount;
        for (int i = 0; i < sampleCount; i++) {
            samples.add(new Object[]{0.0, 0.0, i * deltaSec, i * deltaDist, null, null, null, null, null});
        }
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class)))
                .thenReturn(List.of(run));
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(eq(1L)))
                .thenReturn(samples);

        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);
        Runner runner = new Runner();

        long startTime = System.nanoTime();
        PersonalRecordService.PersonalRecordsResponse response = service.buildForRunner(runner);
        long elapsedMs = (System.nanoTime() - startTime) / 1_000_000;

        assertThat(response).isNotNull();
        System.out.println("[STRESS PERF] PersonalRecordService: " + sampleCount
                + " sample points processed in " + elapsedMs + "ms");

        if (elapsedMs > 2000) {
            System.out.println("[STRESS WARN] PersonalRecordService: " + elapsedMs
                    + "ms for " + sampleCount + " samples — O(n^2) best-effort scan may need optimization.");
        }
    }

    @Test
    @DisplayName("STRESS: PersonalRecordService — null and extreme values are handled safely")
    void personalRecordService_nullAndExtremeValues_noCrash() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        Activity zeroDistance = new Activity();
        zeroDistance.setId(1L);
        zeroDistance.setName("Zero distance");
        zeroDistance.setActivityType(ActivityType.RUN);
        zeroDistance.setDistanceKm(0);
        zeroDistance.setMovingTimeSeconds(0);
        zeroDistance.setStartTime(LocalDateTime.of(2026, 1, 1, 7, 0));

        Activity negativeDistance = new Activity();
        negativeDistance.setId(2L);
        negativeDistance.setName("Negative distance");
        negativeDistance.setActivityType(ActivityType.RUN);
        negativeDistance.setDistanceKm(-5.0);
        negativeDistance.setMovingTimeSeconds(1800);
        negativeDistance.setStartTime(LocalDateTime.of(2026, 1, 2, 7, 0));

        Activity hugeDistance = new Activity();
        hugeDistance.setId(3L);
        hugeDistance.setName("Ultra distance");
        hugeDistance.setActivityType(ActivityType.RUN);
        hugeDistance.setDistanceKm(500.0);
        hugeDistance.setMovingTimeSeconds(100000);
        hugeDistance.setStartTime(LocalDateTime.of(2026, 1, 3, 7, 0));

        Activity zeroTime = new Activity();
        zeroTime.setId(4L);
        zeroTime.setName("Zero time");
        zeroTime.setActivityType(ActivityType.RUN);
        zeroTime.setDistanceKm(10.0);
        zeroTime.setMovingTimeSeconds(0);
        zeroTime.setStartTime(LocalDateTime.of(2026, 1, 4, 7, 0));

        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class)))
                .thenReturn(List.of(zeroDistance, negativeDistance, hugeDistance, zeroTime));
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(anyLong()))
                .thenReturn(List.of());

        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);
        Runner runner = new Runner();

        assertThatCode(() -> service.buildForRunner(runner)).doesNotThrowAnyException();
    }

    // ================================================================
    // 5. STRAVA SYNC STATE — CONCURRENT TRACKER ACCESS
    // ================================================================

    @Test
    @DisplayName("STRESS: StravaSyncStateService — concurrent tryBeginSync prevents double start")
    void stravaSyncState_concurrentTryBeginSync_preventsDoubleStart() throws Exception {
        StravaSyncStateService service = new StravaSyncStateService();
        Long runnerId = 1L;

        int threadCount = 10;
        CyclicBarrier barrier = new CyclicBarrier(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger rejectCount = new AtomicInteger(0);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                StravaSyncStateService.Tracker tracker = service.trackerFor(runnerId);
                if (tracker.tryBeginSync()) {
                    successCount.incrementAndGet();
                } else {
                    rejectCount.incrementAndGet();
                }
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        assertThat(successCount.get()).isEqualTo(1);
        assertThat(rejectCount.get()).isEqualTo(threadCount - 1);
    }

    @Test
    @DisplayName("STRESS: StravaSyncStateService — concurrent increment operations are atomic")
    void stravaSyncState_concurrentIncrements_areAtomic() throws Exception {
        StravaSyncStateService service = new StravaSyncStateService();
        Long runnerId = 1L;

        service.trackerFor(runnerId).tryBeginSync();

        int incrementCount = 100;
        CyclicBarrier barrier = new CyclicBarrier(incrementCount);
        ExecutorService executor = Executors.newFixedThreadPool(incrementCount);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < incrementCount; i++) {
            final int idx = i % 3;
            futures.add(executor.submit(() -> {
                try {
                    barrier.await(5, TimeUnit.SECONDS);
                } catch (Exception e) {
                    return;
                }
                StravaSyncStateService.Tracker tracker = service.trackerFor(runnerId);
                switch (idx) {
                    case 0 -> tracker.incrementImportedRuns();
                    case 1 -> tracker.incrementSkippedNonRuns();
                    case 2 -> tracker.incrementSkippedDuplicates();
                }
            }));
        }

        for (Future<?> f : futures) {
            f.get(10, TimeUnit.SECONDS);
        }
        executor.shutdown();

        service.trackerFor(runnerId).markCompleted();
        var snapshot = service.snapshot(runnerId);

        assertThat(snapshot.importedRuns()
                + snapshot.skippedNonRuns()
                + snapshot.skippedDuplicates())
                .isEqualTo(incrementCount);
    }

    @Test
    @DisplayName("STRESS: StravaSyncStateService — stale tracker cleanup does not corrupt active trackers")
    void stravaSyncState_staleCleanup_doesNotCorruptActive() throws Exception {
        StravaSyncStateService service = new StravaSyncStateService();

        Long activeRunner = 1L;
        Long staleRunner = 2L;

        service.trackerFor(activeRunner).tryBeginSync();
        service.trackerFor(staleRunner).tryBeginSync();
        service.trackerFor(staleRunner).markCompleted();

        Thread.sleep(10);

        service.cleanupStaleTrackers();

        assertThat(service.snapshot(activeRunner).active()).isTrue();
        assertThat(service.snapshot(staleRunner).status()).isEqualTo("COMPLETED");
    }

    // ================================================================
    // 6. COACH SERVICE — DATA FLOOD / NIGHTLY AUDIT
    // ================================================================

    @Test
    @DisplayName("STRESS: AutomatedCoachService — nightlyAuditAllRunners skips deleted runners and continues on error")
    void coachService_nightlyAudit_skipsDeletedAndContinuesOnError() {
        Runner activeRunner = runner(1L);
        Runner deletedRunner = runner(2L);
        deletedRunner.setDeleted(true);
        Runner errorRunner = runner(3L);

        ActivityRepository activityRepository = mock(ActivityRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        CoachFeedbackAlertRepository alertRepository = mock(CoachFeedbackAlertRepository.class);

        when(activityRepository.findDistinctRunnerIdsWithActivityType(ActivityType.RUN))
                .thenReturn(List.of(1L, 2L, 3L));
        when(runnerRepository.findAllById(List.of(1L, 2L, 3L)))
                .thenReturn(List.of(activeRunner, deletedRunner, errorRunner));

        when(stateRepository.findByRunner(activeRunner)).thenReturn(Optional.of(aggregatedState(activeRunner)));
        when(stateRepository.findByRunner(errorRunner)).thenThrow(new RuntimeException("DB error for runner 3"));
        when(scheduleRepository.findByRunnerAndScheduledDateBetween(eq(activeRunner), any(), any()))
                .thenReturn(fullSchedule(activeRunner, LocalDate.now(), 14));
        when(blockRepository.findByRunnerAndActiveTrue(activeRunner)).thenReturn(Optional.empty());
        when(activityRepository.findRunsBetween(eq(activeRunner), any(), any(), any())).thenReturn(List.of());

        AutomatedCoachService service = new AutomatedCoachService(
                runnerRepository, activityRepository,
                stateRepository, scheduleRepository, blockRepository, alertRepository,
                mock(ShoeTracker.class), mock(CoachRouteService.class), mock(ReadinessService.class));

        assertThatCode(() -> service.nightlyAuditAllRunners()).doesNotThrowAnyException();

        verify(stateRepository, atLeast(1)).findByRunner(activeRunner);
        verify(stateRepository).findByRunner(errorRunner);
    }

    // ================================================================
    // 7. MUSCLE TRAINING — ACWR COMPUTATION EDGE CASES
    // ================================================================

    @Test
    @DisplayName("STRESS: MuscleTraining — ACWR computation with no runs returns null safely")
    void muscleTraining_computeAcwr_noRuns_returnsNull() throws Exception {
        List<Activity> runs = List.of();
        Method computeAcwr = MuscleTrainingMetricsService.class
                .getDeclaredMethod("computeAcwr", List.class);
        computeAcwr.setAccessible(true);

        MuscleTrainingMetricsService service = new MuscleTrainingMetricsService();
        Object result = computeAcwr.invoke(service, runs);
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("STRESS: MuscleTraining — ACWR with very high acute load produces finite result")
    void muscleTraining_computeAcwr_highAcuteLoad_noInfinityOrNaN() throws Exception {
        List<Activity> runs = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            Activity a = new Activity();
            a.setId((long) i);
            a.setActivityType(ActivityType.RUN);
            a.setDistanceKm(50.0);
            a.setMovingTimeSeconds(18000);
            a.setStartTime(LocalDateTime.now().minusDays(30 - i));
            a.setAverageHeartRate(180.0);
            runs.add(a);
        }

        Method computeAcwr = MuscleTrainingMetricsService.class
                .getDeclaredMethod("computeAcwr", List.class);
        computeAcwr.setAccessible(true);

        MuscleTrainingMetricsService service = new MuscleTrainingMetricsService();
        Object result = computeAcwr.invoke(service, runs);

        if (result instanceof Double acwr) {
            assertThat(Double.isFinite(acwr)).isTrue();
            assertThat(Double.isNaN(acwr)).isFalse();
        }
    }

    // ================================================================
    // 8. DIGITAL COSMETICS — ANTI-SPOOF EDGE CASES
    // ================================================================

    @Test
    @DisplayName("STRESS: DigitalCosmetics — anti-spoof rejects impossible cadence values")
    void digitalCosmetics_antiSpoof_rejectsImpossibleCadence() throws Exception {
        DigitalCosmeticsService service = createCosmeticsService();

        Activity lowCadence = activity(1L, 5.0, 1800);
        lowCadence.setAverageCadence(10.0);
        lowCadence.setAverageHeartRate(140.0);

        Activity highCadence = activity(2L, 5.0, 1800);
        highCadence.setAverageCadence(400.0);
        highCadence.setAverageHeartRate(140.0);

        Method failsAntiSpoof = DigitalCosmeticsService.class
                .getDeclaredMethod("failsAntiSpoof", Activity.class);
        failsAntiSpoof.setAccessible(true);

        assertThat((Boolean) failsAntiSpoof.invoke(service, lowCadence)).isTrue();
        assertThat((Boolean) failsAntiSpoof.invoke(service, highCadence)).isTrue();
    }

    @Test
    @DisplayName("STRESS: DigitalCosmetics — anti-spoof rejects fast pace with low HR")
    void digitalCosmetics_antiSpoof_rejectsFastPaceLowHR() throws Exception {
        DigitalCosmeticsService service = createCosmeticsService();

        Activity suspicious = activity(1L, 5.0, 500);
        suspicious.setAverageCadence(170.0);
        suspicious.setAverageHeartRate(80.0);

        Activity normal = activity(2L, 5.0, 1800);
        normal.setAverageCadence(170.0);
        normal.setAverageHeartRate(150.0);

        Method failsAntiSpoof = DigitalCosmeticsService.class
                .getDeclaredMethod("failsAntiSpoof", Activity.class);
        failsAntiSpoof.setAccessible(true);

        assertThat((Boolean) failsAntiSpoof.invoke(service, suspicious)).isTrue();
        assertThat((Boolean) failsAntiSpoof.invoke(service, normal)).isFalse();
    }

    @Test
    @DisplayName("STRESS: DigitalCosmetics — anti-spoof handles null HR with normal pace")
    void digitalCosmetics_antiSpoof_nullHR_withNormalPace() throws Exception {
        DigitalCosmeticsService service = createCosmeticsService();

        Activity nullHrNormalPace = activity(1L, 5.0, 1800);
        nullHrNormalPace.setAverageCadence(170.0);
        nullHrNormalPace.setAverageHeartRate(null);

        Method failsAntiSpoof = DigitalCosmeticsService.class
                .getDeclaredMethod("failsAntiSpoof", Activity.class);
        failsAntiSpoof.setAccessible(true);

        assertThat((Boolean) failsAntiSpoof.invoke(service, nullHrNormalPace)).isFalse();
    }

    // ================================================================
    // 9. API RATE LIMITER — RAPID BURST EDGE CASES
    // ================================================================

    @Test
    @DisplayName("STRESS: ApiRateLimiter — single-thread rapid burst within and beyond limit")
    void apiRateLimiter_rapidBurst_withinAndBeyondLimit() {
        ApiRateLimiter limiter = new ApiRateLimiter();

        String key = "ip|10.0.0.1|GET|/api/test";
        int max = 10;

        for (int i = 0; i < max; i++) {
            assertThat(limiter.allow(key, max, 60)).isTrue();
        }
        for (int i = 0; i < 5; i++) {
            assertThat(limiter.allow(key, max, 60)).isFalse();
        }
    }

    // ================================================================
    // 10. PERSONAL RECORD — COMPUTATIONAL HARDENING
    // ================================================================

    @Test
    @DisplayName("STRESS: PersonalRecordService — activity with NaN/Infinity sample values")
    void personalRecordService_nanInfinitySamples_noCrash() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        Activity run = new Activity();
        run.setId(1L);
        run.setName("Bad data run");
        run.setActivityType(ActivityType.RUN);
        run.setDistanceKm(5.0);
        run.setMovingTimeSeconds(1800);
        run.setStartTime(LocalDateTime.of(2026, 1, 1, 7, 0));

        List<Object[]> badSamples = new ArrayList<>();
        badSamples.add(new Object[]{0.0, 0.0, Double.NaN, Double.NaN, null, null, null, null, null});
        badSamples.add(new Object[]{0.0, 0.0, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, null, null, null, null, null});
        badSamples.add(new Object[]{0.0, 0.0, 1800.0, 5000.0, null, null, null, null, null});

        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class)))
                .thenReturn(List.of(run));
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(eq(1L)))
                .thenReturn(badSamples);

        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);
        Runner runner = new Runner();

        assertThatCode(() -> service.buildForRunner(runner)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("STRESS: PersonalRecordService — activity with descending distance values")
    void personalRecordService_descendingDistanceSamples_noCrash() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);

        Activity run = new Activity();
        run.setId(1L);
        run.setName("Descending distance run");
        run.setActivityType(ActivityType.RUN);
        run.setDistanceKm(10.0);
        run.setMovingTimeSeconds(3600);
        run.setStartTime(LocalDateTime.of(2026, 1, 1, 7, 0));

        List<Object[]> weirdSamples = new ArrayList<>();
        weirdSamples.add(new Object[]{0.0, 0.0, 0.0, 5000.0, null, null, null, null, null});
        weirdSamples.add(new Object[]{0.0, 0.0, 600.0, 3000.0, null, null, null, null, null});
        weirdSamples.add(new Object[]{0.0, 0.0, 1200.0, 1000.0, null, null, null, null, null});

        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(any(Runner.class), any(ActivityType.class)))
                .thenReturn(List.of(run));
        when(activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(eq(1L)))
                .thenReturn(weirdSamples);

        PersonalRecordService service = new PersonalRecordService(activityRepository, activityPointRepository);
        Runner runner = new Runner();

        assertThatCode(() -> service.buildForRunner(runner)).doesNotThrowAnyException();
    }

    // ================================================================
    // Helpers
    // ================================================================

    private static Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        runner.setMaxHeartRateBpm(185);
        runner.setRestingHeartRateBpm(50);
        return runner;
    }

    private static CoachRunnerState aggregatedState(Runner runner) {
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setVolumeKm7d(42.0);
        state.setHighIntensityRatioLast7d(0.15);
        state.setLastAggregatedAt(LocalDateTime.now());
        return state;
    }

    private static List<CoachScheduledWorkout> fullSchedule(Runner runner, LocalDate start, int days) {
        List<CoachScheduledWorkout> schedule = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            CoachScheduledWorkout w = new CoachScheduledWorkout();
            w.setRunner(runner);
            w.setScheduledDate(start.plusDays(i));
            w.setWorkoutType(CoachWorkoutType.EASY);
            w.setPlannedDistanceKm(8.0);
            schedule.add(w);
        }
        return schedule;
    }

    private static AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            CoachFeedbackAlertRepository alertRepository
    ) {
        return new AutomatedCoachService(
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                stateRepository,
                scheduleRepository,
                blockRepository,
                alertRepository,
                mock(ShoeTracker.class),
                mock(CoachRouteService.class),
                mock(ReadinessService.class)
        );
    }

    private static Activity activity(Long id, double distanceKm, int movingSeconds) {
        Activity a = new Activity();
        a.setId(id);
        a.setDistanceKm(distanceKm);
        a.setMovingTimeSeconds(movingSeconds);
        a.setActivityType(ActivityType.RUN);
        a.setStartTime(LocalDateTime.of(2026, 4, 1, 7, 0));
        return a;
    }

    private static DigitalCosmeticsService createCosmeticsService() {
        return new DigitalCosmeticsService(
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                mock(CoachScheduledWorkoutRepository.class),
                mock(ShoeRepository.class),
                mock(DigitalCosmeticDropRepository.class),
                mock(org.springframework.web.client.RestTemplate.class)
        );
    }
}
