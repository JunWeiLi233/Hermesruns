package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
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
                wellnessRepository
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
                wellnessRepository
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
                wellnessRepository
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
                wellnessRepository
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
    void readinessTrendUsesPreferredSourcesWhenMultipleProvidersShareADate() {
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);
        ReadinessService service = new ReadinessService(
                sleepRepository,
                hrvRepository,
                stressRepository,
                wellnessRepository
        );

        Runner runner = new Runner();
        runner.setWellnessSleepSource("GARMIN");
        runner.setWellnessHrvSource("APPLE_HEALTH");
        runner.setWellnessStressSource("GARMIN");
        LocalDate today = LocalDate.now();

        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.APPLE_HEALTH, 45), sleep(today, ImportProvider.GARMIN, 92)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.GARMIN, 42.0, "LOW"), hrv(today, ImportProvider.APPLE_HEALTH, 88.0, "BALANCED")));
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(stress(today, ImportProvider.GARMIN, 18)));
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of());

        List<ReadinessService.ReadinessDay> trend = service.getReadinessTrend(runner, 1);

        assertThat(trend).hasSize(1);
        assertThat(trend.get(0).score()).isEqualTo(100);
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
