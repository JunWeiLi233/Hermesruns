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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoogleHealthImportServiceTest {

    private DailyWellnessSummaryRepository wellnessSummaryRepository;
    private DailySleepDataRepository sleepDataRepository;
    private DailyHRVDataRepository hrvDataRepository;
    private DailyStressDataRepository stressDataRepository;
    private RunnerRepository runnerRepository;
    private CoachRunnerStateRepository coachRunnerStateRepository;
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private GoogleHealthImportService service;

    @BeforeEach
    void setUp() {
        wellnessSummaryRepository = mock(DailyWellnessSummaryRepository.class);
        sleepDataRepository = mock(DailySleepDataRepository.class);
        hrvDataRepository = mock(DailyHRVDataRepository.class);
        stressDataRepository = mock(DailyStressDataRepository.class);
        runnerRepository = mock(RunnerRepository.class);
        coachRunnerStateRepository = mock(CoachRunnerStateRepository.class);
        objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        service = new GoogleHealthImportService(
                wellnessSummaryRepository, sleepDataRepository, hrvDataRepository,
                stressDataRepository, runnerRepository, coachRunnerStateRepository, objectMapper
        );
    }

    @Test
    void healthSyncTrackerTryBeginTransitionsToRunning() {
        GoogleHealthImportService.HealthSyncTracker tracker = new GoogleHealthImportService.HealthSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        GoogleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isTrue();
        assertThat(snapshot.failed()).isFalse();
    }

    @Test
    void healthSyncTrackerTryBeginReturnsFalseWhenAlreadyRunning() {
        GoogleHealthImportService.HealthSyncTracker tracker = new GoogleHealthImportService.HealthSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        assertThat(tracker.tryBegin()).isFalse();
    }

    @Test
    void healthSyncTrackerMarkCompletedStopsRunning() {
        GoogleHealthImportService.HealthSyncTracker tracker = new GoogleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.addProcessed(4);
        tracker.markCompleted("Done");
        GoogleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isFalse();
        assertThat(snapshot.processed()).isEqualTo(4);
        assertThat(snapshot.message()).isEqualTo("Done");
        assertThat(snapshot.failed()).isFalse();
    }

    @Test
    void healthSyncTrackerMarkFailedStopsRunningAndMarksFailed() {
        GoogleHealthImportService.HealthSyncTracker tracker = new GoogleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.markFailed("Connection error");
        GoogleHealthImportService.HealthSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.running()).isFalse();
        assertThat(snapshot.failed()).isTrue();
        assertThat(snapshot.message()).isEqualTo("Connection error");
    }

    @Test
    void healthSyncTrackerCanBeReusedAfterCompletion() {
        GoogleHealthImportService.HealthSyncTracker tracker = new GoogleHealthImportService.HealthSyncTracker();
        tracker.tryBegin();
        tracker.markCompleted("First done");
        assertThat(tracker.tryBegin()).isTrue();
    }

    @Test
    void healthSyncStatusIdleReturnsDefaultState() {
        GoogleHealthImportService.HealthSyncStatus idle = GoogleHealthImportService.HealthSyncStatus.idle();
        assertThat(idle.running()).isFalse();
        assertThat(idle.processed()).isZero();
        assertThat(idle.message()).isEqualTo("Idle");
        assertThat(idle.failed()).isFalse();
    }

    @Test
    void getStatusReturnsIdleWhenNoTrackerExists() {
        GoogleHealthImportService.HealthSyncStatus status = service.getStatus(999L);
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

        Map<String, Object> dataPoint = Map.of("type", "wellness", "date", "2026-04-20", "restingHeartRate", 60);
        assertThat(service.importWellnessData(runner, List.of(dataPoint))).isTrue();
        assertThat(service.importWellnessData(runner, List.of(dataPoint))).isFalse();
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
                "restingHeartRate", 60,
                "steps", 10000L,
                "activeCalories", 350.0
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
                "score", 75,
                "durationMinutes", 390
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
                "hrv", 55.0
        );

        service.importWellnessData(runner, List.of(hrvPoint));

        Thread.sleep(2000);

        verify(hrvDataRepository).save(any(DailyHRVData.class));
    }

    @Test
    void processDataPointsUpdatesExistingRecord() throws InterruptedException {
        Runner runner = runner(1L);
        DailySleepData existing = new DailySleepData();
        when(sleepDataRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GOOGLE_HEALTH, LocalDate.of(2026, 4, 20)))
                .thenReturn(Optional.of(existing));
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.empty());

        Map<String, Object> sleepPoint = Map.of(
                "type", "sleep",
                "date", "2026-04-20",
                "score", 88,
                "durationMinutes", 450
        );

        service.importWellnessData(runner, List.of(sleepPoint));

        Thread.sleep(2000);

        verify(sleepDataRepository).save(existing);
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

        Map<String, Object> unknown = Map.of("type", "steps", "date", "2026-04-20");

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

        assertThat(service.getStatus(1L).running()).isTrue();
        assertThat(service.getStatus(2L).running()).isTrue();
    }

    private Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}