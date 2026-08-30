package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReadinessServiceTests {

    @Test
    void resolveReadinessSnapshotUsesPreferredSourcesPerMetric() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        runner.setWellnessSleepSource("GARMIN");
        runner.setWellnessHrvSource("APPLE_HEALTH");
        runner.setWellnessRestingHrSource("GARMIN");
        runner.setWellnessStressSource("GARMIN");

        CoachRunnerState state = new CoachRunnerState();
        state.setBaselineRestingHr(50);

        LocalDate today = LocalDate.of(2026, 4, 25);

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.GARMIN, 92), sleep(today, ImportProvider.APPLE_HEALTH, 61)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.GARMIN, 42.0, "LOW"), hrv(today, ImportProvider.APPLE_HEALTH, 88.0, null)));
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(stress(today, ImportProvider.GARMIN, 18)));
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(wellness(today, ImportProvider.GARMIN, 52), wellness(today, ImportProvider.APPLE_HEALTH, 59)));

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.sources().sleep()).isEqualTo("GARMIN");
        assertThat(snapshot.sources().hrv()).isEqualTo("APPLE_HEALTH");
        assertThat(snapshot.sources().restingHeartRate()).isEqualTo("GARMIN");
        assertThat(snapshot.sources().stress()).isEqualTo("GARMIN");
        assertThat(snapshot.readiness().sleepScore()).isEqualTo(92);
        assertThat(snapshot.readiness().hrvScore()).isEqualTo(85);
    }

    @Test
    void resolveReadinessSnapshotFallsBackToAutoRankingWhenNoPreferenceIsStored() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setBaselineRestingHr(54);
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.APPLE_HEALTH, 70), sleep(today, ImportProvider.GARMIN, 81)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.GOOGLE_HEALTH, 64.0, null), hrv(today, ImportProvider.APPLE_HEALTH, 72.0, null)));
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(stress(today, ImportProvider.GARMIN, 22)));
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(wellness(today, ImportProvider.GARMIN, 55)));

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.sources().sleep()).isEqualTo("GARMIN");
        assertThat(snapshot.sources().hrv()).isEqualTo("APPLE_HEALTH");
    }

    @Test
    void resolveReadinessSnapshotUsesCoachStateWhenManualSourceIsPreferred() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        runner.setWellnessHrvSource("MANUAL");
        CoachRunnerState state = new CoachRunnerState();
        state.setLastHrvStatus("LOW");
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.APPLE_HEALTH, 88.0, "BALANCED")));

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.sources().hrv()).isEqualTo("MANUAL");
        assertThat(snapshot.readiness().hrvScore()).isEqualTo(45);
    }

    @Test
    void dailyReadinessMarksFallbackOnlyScoreAsNoData() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        runner.setRestingHeartRateBpm(52);
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());

        ReadinessService.ReadinessDay day = service.getDailyReadiness(runner, today);

        assertThat(day.score()).isEqualTo(75);
        assertThat(day.hasData()).isFalse();
    }

    @Test
    void readinessSnapshotDoesNotPresentCachedSleepAsCurrentDateEvidence() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setLastSleepScore(88);
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.readiness().sleepScore()).isEqualTo(88);
        assertThat(snapshot.availability().sleep()).isFalse();
        assertThat(snapshot.availability().any()).isFalse();
    }

    @Test
    void readinessSnapshotReportsExactDateMetricEvidence() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        CoachRunnerState state = new CoachRunnerState();
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.GARMIN, 91)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today)).thenReturn(List.of());

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.availability().sleep()).isTrue();
        assertThat(snapshot.availability().hrv()).isFalse();
        assertThat(snapshot.availability().any()).isTrue();
        assertThat(snapshot.sources().sleep()).isEqualTo("GARMIN");
    }

    @Test
    void readinessTrendUsesPreferredSourcesWhenMultipleProvidersShareADate() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                mock(ActivityRepository.class)
        );

        Runner runner = new Runner();
        runner.setWellnessSleepSource("GARMIN");
        runner.setWellnessHrvSource("APPLE_HEALTH");
        runner.setWellnessStressSource("GARMIN");
        LocalDate today = LocalDate.now();

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.APPLE_HEALTH, 45), sleep(today, ImportProvider.GARMIN, 92)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today.minusDays(56), today))
                .thenReturn(List.of(hrv(today, ImportProvider.GARMIN, 42.0, "LOW"), hrv(today, ImportProvider.APPLE_HEALTH, 88.0, "BALANCED")));
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(stress(today, ImportProvider.GARMIN, 18)));
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of());

        List<ReadinessService.ReadinessDay> trend = service.getReadinessTrend(runner, 1);

        assertThat(trend).hasSize(1);
        // Weighted aggregation over available metrics (sleep .28, HRV .24,
        // stress .14) shrunk toward neutral 75 by the missing evidence weight.
        assertThat(trend.get(0).score()).isEqualTo(83);
        assertThat(trend.get(0).hasData()).isTrue();
    }

    @Test
    void resolveReadinessSnapshotStaysNeutralWhenNoEvidenceExists() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                activityRepository
        );

        Runner runner = new Runner();
        CoachRunnerState state = new CoachRunnerState();
        LocalDate today = LocalDate.of(2026, 4, 25);

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        assertThat(snapshot.readiness().score()).isEqualTo(75);
        assertThat(snapshot.readiness().verdict()).isEqualTo("EASY");
        assertThat(snapshot.readiness().confidence()).isZero();
        assertThat(snapshot.readiness().loadScore()).isEqualTo(75);
    }

    @Test
    void hrvIsScoredAgainstPersonalBaselineWhenHistoryExists() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                activityRepository
        );

        Runner runner = new Runner();
        CoachRunnerState state = new CoachRunnerState();
        LocalDate today = LocalDate.of(2026, 4, 25);

        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.GARMIN, 40.0, null)));
        List<DailyHRVData> baseline = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            double value = i % 2 == 0 ? 66.0 : 70.0; // mean 68, SD 2 -> SWC 1ms
            baseline.add(hrv(today.minusDays(i), ImportProvider.GARMIN, value, null));
        }
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today.minusDays(28), today.minusDays(1)))
                .thenReturn(baseline);

        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                service.resolveReadinessSnapshot(runner, state, today);

        // 40ms is far below the personal 68ms baseline: relative scoring says
        // 45 where absolute bands would have said 60.
        assertThat(snapshot.readiness().hrvScore()).isEqualTo(45);
        assertThat(snapshot.readiness().confidence()).isEqualTo(24);
    }

    @Test
    void readinessAdaptsToTrainingLoadWhenWellnessDataIsMissing() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository,
                activityRepository
        );

        Runner steadyRunner = new Runner();
        steadyRunner.setId(1L);
        Runner spikingRunner = new Runner();
        spikingRunner.setId(2L);
        LocalDate today = LocalDate.now();

        List<RunMetricsProjection> steadyRuns = new ArrayList<>();
        for (int i = 27; i >= 3; i--) {
            LocalDate day = today.minusDays(i);
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) continue;
            steadyRuns.add(runMetric(day.atTime(7, 0), 8.0, 2_400));
        }

        List<RunMetricsProjection> spikeRuns = new ArrayList<>(steadyRuns);
        for (int i = 2; i >= 0; i--) {
            spikeRuns.add(runMetric(today.minusDays(i).atTime(7, 0), 14.0, 3_000));
        }

        when(activityRepository.findRunMetricsBetween(eq(steadyRunner), eq(ActivityType.RUN), any(), any()))
                .thenReturn(steadyRuns);
        when(activityRepository.findRunMetricsBetween(eq(spikingRunner), eq(ActivityType.RUN), any(), any()))
                .thenReturn(spikeRuns);

        ReadinessService.MultiSourceReadinessSnapshot steady =
                service.resolveReadinessSnapshot(steadyRunner, new CoachRunnerState(), today);
        ReadinessService.MultiSourceReadinessSnapshot spiking =
                service.resolveReadinessSnapshot(spikingRunner, new CoachRunnerState(), today);

        // No wellness data at all: the training-load proxy is the only
        // evidence, so confidence is capped at its 20% weight.
        assertThat(steady.availability().trainingLoad()).isTrue();
        assertThat(steady.readiness().confidence()).isEqualTo(20);
        assertThat(steady.readiness().loadScore()).isGreaterThanOrEqualTo(78);
        assertThat(steady.readiness().verdict()).isEqualTo("EASY");

        // A three-day spike pushes ACWR far past the 1.5 danger zone; the
        // score must fall below the steady runner's and leave recovery mode.
        assertThat(spiking.readiness().loadScore()).isLessThanOrEqualTo(70);
        assertThat(spiking.readiness().score()).isLessThan(steady.readiness().score());
        assertThat(spiking.readiness().verdict()).isEqualTo("RECOVERY");
    }

    private RunMetricsProjection runMetric(LocalDateTime startedAt, double distanceKm, long durationSeconds) {
        RunMetricsProjection projection = mock(RunMetricsProjection.class);
        when(projection.getEffectiveStartTime()).thenReturn(startedAt);
        when(projection.getDistanceKm()).thenReturn(distanceKm);
        when(projection.getDistanceMeters()).thenReturn(distanceKm * 1000.0);
        when(projection.getDurationSeconds()).thenReturn(durationSeconds);
        when(projection.getMovingTimeSeconds()).thenReturn((int) durationSeconds);
        when(projection.getMaxHeartRate()).thenReturn(null);
        return projection;
    }

    private DailySleepData sleep(LocalDate date, ImportProvider provider, Integer score) {
        DailySleepData data = new DailySleepData();
        data.setDate(date);
        data.setProvider(provider);
        data.setSleepScore(score);
        return data;
    }

    private DailyHRVData hrv(LocalDate date, ImportProvider provider, Double avg, String status) {
        DailyHRVData data = new DailyHRVData();
        data.setDate(date);
        data.setProvider(provider);
        data.setLastNightAvg(avg);
        data.setStatus(status);
        return data;
    }

    private DailyStressData stress(LocalDate date, ImportProvider provider, Integer overallStress) {
        DailyStressData data = new DailyStressData();
        data.setDate(date);
        data.setProvider(provider);
        data.setOverallStressLevel(overallStress);
        return data;
    }

    private DailyWellnessSummary wellness(LocalDate date, ImportProvider provider, Integer restingHeartRate) {
        DailyWellnessSummary data = new DailyWellnessSummary();
        data.setDate(date);
        data.setProvider(provider);
        data.setRestingHeartRate(restingHeartRate);
        return data;
    }
}
