package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AppleHealthImportServiceTest {

    private DailyWellnessSummaryRepository wellnessSummaryRepository;
    private DailySleepDataRepository sleepDataRepository;
    private DailyHRVDataRepository hrvDataRepository;
    private DailyStressDataRepository stressDataRepository;
    private RunnerRepository runnerRepository;
    private CoachRunnerStateRepository coachRunnerStateRepository;
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private AppleHealthImportService service;

    @BeforeEach
    void setUp() {
        wellnessSummaryRepository = mock(DailyWellnessSummaryRepository.class);
        sleepDataRepository = mock(DailySleepDataRepository.class);
        hrvDataRepository = mock(DailyHRVDataRepository.class);
        stressDataRepository = mock(DailyStressDataRepository.class);
        runnerRepository = mock(RunnerRepository.class);
        coachRunnerStateRepository = mock(CoachRunnerStateRepository.class);
        objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        service = new AppleHealthImportService(
                wellnessSummaryRepository, sleepDataRepository, hrvDataRepository,
                stressDataRepository, runnerRepository, coachRunnerStateRepository, objectMapper
        );
    }

    @Test
    void healthSyncTrackerTryBeginTransitionsToRunning() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        AppleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isTrue();
        assertThat(snapshot.failed()).isFalse();
    }

    @Test
    void healthSyncTrackerTryBeginReturnsFalseWhenAlreadyRunning() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        assertThat(tracker.tryBegin()).isFalse();
    }

    @Test
    void healthSyncTrackerMarkCompletedStopsRunning() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.addProcessed(5);
        tracker.markCompleted("Done");
        AppleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isFalse();
        assertThat(snapshot.processed()).isEqualTo(5);
        assertThat(snapshot.message()).isEqualTo("Done");
        assertThat(snapshot.failed()).isFalse();
    }

    @Test
    void healthSyncTrackerMarkFailedStopsRunningAndMarksFailed() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.markFailed("Timeout");
        AppleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isFalse();
        assertThat(snapshot.failed()).isTrue();
        assertThat(snapshot.message()).isEqualTo("Timeout");
    }

    @Test
    void healthSyncTrackerCanBeReusedAfterCompletion() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.markCompleted("First run done");
        assertThat(tracker.tryBegin()).isTrue();
    }

    @Test
    void healthSyncTrackerAddProcessedAccumulates() {
        AppleHealthImportService.HealthSyncTracker tracker = new AppleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.addProcessed(3);
        tracker.addProcessed(2);
        assertThat(tracker.snapshot().processed()).isEqualTo(5);
    }

    @Test
    void healthSyncStatusIdleReturnsDefaultState() {
        AppleHealthImportService.HealthSyncStatus idle = AppleHealthImportService.HealthSyncStatus.idle();
        assertThat(idle.running()).isFalse();
        assertThat(idle.processed()).isZero();
        assertThat(idle.message()).isEqualTo("Idle");
        assertThat(idle.failed()).isFalse();
    }

    @Test
    void getStatusReturnsIdleWhenNoTrackerExists() {
        AppleHealthImportService.HealthSyncStatus status = service.getStatus(999L);
        assertThat(status.running()).isFalse();
        assertThat(status.processed()).isZero();
    }

    @Test
    void importWellnessDataReturnsTrue() {
        Runner runner = runner(1L);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());

        boolean result = service.importWellnessData(runner, List.of());
        assertThat(result).isTrue();
    }

    @Test
    void importWellnessDataReturnsFalseWhenAlreadyRunning() {
        Runner runner = runner(1L);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> dataPoint = Map.of("type", "wellness", "date", "2026-04-20", "restingHeartRate", 58);
        assertThat(service.importWellnessData(runner, List.of(dataPoint))).isTrue();
        assertThat(service.importWellnessData(runner, List.of(dataPoint))).isFalse();
    }

    @Test
    void importWellnessDataCanStartAgainAfterCompletion() throws InterruptedException {
        Runner runner = runner(1L);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(sleepDataRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(hrvDataRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        boolean first = service.importWellnessData(runner, List.of(Map.of("type", "wellness", "date", "2026-04-20", "restingHeartRate", 58)));
        assertThat(first).isTrue();

        Thread.sleep(2000);

        AppleHealthImportService.HealthSyncStatus status = service.getStatus(1L);
        assertThat(status.running()).isFalse();
        assertThat(status.failed()).isFalse();

        boolean second = service.importWellnessData(runner, List.of());
        assertThat(second).isTrue();
    }

    @Test
    void processDataPointsSavesWellnessEntry() throws InterruptedException {
        Runner runner = runner(1L);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> wellnessPoint = Map.of(
                "type", "wellness",
                "date", "2026-04-20",
                "restingHeartRate", 58,
                "steps", 8500L,
                "activeCalories", 320.0
        );

        service.importWellnessData(runner, List.of(wellnessPoint));

        Thread.sleep(2000);

        verify(wellnessSummaryRepository).save(any(DailyWellnessSummary.class));
    }

    @Test
    void processDataPointsSavesSleepEntry() throws InterruptedException {
        Runner runner = runner(1L);
        when(sleepDataRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> sleepPoint = Map.of(
                "type", "sleep",
                "date", "2026-04-20",
                "score", 82,
                "durationMinutes", 420,
                "deepMinutes", 60,
                "remMinutes", 90
        );

        service.importWellnessData(runner, List.of(sleepPoint));

        Thread.sleep(2000);

        verify(sleepDataRepository).save(any(DailySleepData.class));
    }

    @Test
    void processDataPointsSavesHrvEntry() throws InterruptedException {
        Runner runner = runner(1L);
        when(hrvDataRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> hrvPoint = Map.of(
                "type", "hrv",
                "date", "2026-04-20",
                "hrv", 42.5
        );

        service.importWellnessData(runner, List.of(hrvPoint));

        Thread.sleep(2000);

        verify(hrvDataRepository).save(any(DailyHRVData.class));
    }

    @Test
    void processDataPointsUpdatesExistingRecord() throws InterruptedException {
        Runner runner = runner(1L);
        DailyWellnessSummary existing = new DailyWellnessSummary();
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.APPLE_HEALTH, LocalDate.of(2026, 4, 20)))
                .thenReturn(Optional.of(existing));
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> wellnessPoint = Map.of(
                "type", "wellness",
                "date", "2026-04-20",
                "restingHeartRate", 55
        );

        service.importWellnessData(runner, List.of(wellnessPoint));

        Thread.sleep(2000);

        verify(wellnessSummaryRepository).save(existing);
    }

    @Test
    void processDataPointsSkipsEntriesWithNullDate() throws InterruptedException {
        Runner runner = runner(1L);
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> noDate = Map.of("type", "wellness");

        service.importWellnessData(runner, List.of(noDate));

        Thread.sleep(1500);

        verify(wellnessSummaryRepository, never()).save(any());
    }

    @Test
    void processDataPointsSkipsEntriesWithUnknownType() throws InterruptedException {
        Runner runner = runner(1L);
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> unknown = Map.of("type", "unknown", "date", "2026-04-20");

        service.importWellnessData(runner, List.of(unknown));

        Thread.sleep(1500);

        verify(wellnessSummaryRepository, never()).save(any());
        verify(sleepDataRepository, never()).save(any());
        verify(hrvDataRepository, never()).save(any());
        verify(stressDataRepository, never()).save(any());
    }

    @Test
    void differentRunnersHaveIndependentSyncStates() {
        Runner runner1 = runner(1L);
        Runner runner2 = runner(2L);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThat(service.importWellnessData(runner1, List.of())).isTrue();
        assertThat(service.importWellnessData(runner2, List.of())).isTrue();

        AppleHealthImportService.HealthSyncStatus status1 = service.getStatus(1L);
        AppleHealthImportService.HealthSyncStatus status2 = service.getStatus(2L);
        assertThat(status1.running()).isTrue();
        assertThat(status2.running()).isTrue();
    }

    private Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}