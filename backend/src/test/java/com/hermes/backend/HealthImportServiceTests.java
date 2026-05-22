package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HealthImportServiceTests {

    @Test
    void appleHealthImportStoresWellnessRowsAndRefreshesCoachRunnerState() {
        DailyWellnessSummaryRepository wellnessSummaryRepository = mock(DailyWellnessSummaryRepository.class);
        DailySleepDataRepository sleepDataRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvDataRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressDataRepository = mock(DailyStressDataRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        CoachRunnerStateRepository coachRunnerStateRepository = mock(CoachRunnerStateRepository.class);
        AppleHealthImportService service = new AppleHealthImportService(
                wellnessSummaryRepository,
                sleepDataRepository,
                hrvDataRepository,
                stressDataRepository,
                runnerRepository,
                coachRunnerStateRepository,
                new ObjectMapper()
        );
        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.APPLE_HEALTH, LocalDate.parse("2026-04-23")))
                .thenReturn(Optional.empty());
        when(sleepDataRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.APPLE_HEALTH, LocalDate.parse("2026-04-23")))
                .thenReturn(Optional.empty());
        when(hrvDataRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.APPLE_HEALTH, LocalDate.parse("2026-04-23")))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        boolean started = service.importWellnessData(runner, List.of(
                Map.of("type", "wellness", "date", "2026-04-23", "restingHeartRate", 51, "steps", 12500),
                Map.of("type", "sleep", "date", "2026-04-23", "score", 88, "durationMinutes", 455),
                Map.of("type", "hrv", "date", "2026-04-23", "hrv", 64.8)
        ));

        assertThat(started).isTrue();
        ArgumentCaptor<DailyWellnessSummary> wellnessCaptor = ArgumentCaptor.forClass(DailyWellnessSummary.class);
        verify(wellnessSummaryRepository, timeout(1000)).save(wellnessCaptor.capture());
        assertThat(wellnessCaptor.getValue().getProvider()).isEqualTo(ImportProvider.APPLE_HEALTH);
        assertThat(wellnessCaptor.getValue().getRestingHeartRate()).isEqualTo(51);
        assertThat(wellnessCaptor.getValue().getTotalSteps()).isEqualTo(12500L);
        verify(sleepDataRepository, timeout(1000)).save(any(DailySleepData.class));
        verify(hrvDataRepository, timeout(1000)).save(any(DailyHRVData.class));
        verify(coachRunnerStateRepository, timeout(1000)).save(state);
        assertThat(state.getLastNightRestingHr()).isEqualTo(51);
        assertThat(state.getBaselineRestingHr()).isEqualTo(51);
        assertThat(state.getLastSleepScore()).isEqualTo(88);
        assertThat(state.getLastHrvMs()).isEqualTo(65);
    }

    @Test
    void googleHealthImportUsesGoogleProviderAndKeepsExistingRestingHeartRateBaseline() {
        DailyWellnessSummaryRepository wellnessSummaryRepository = mock(DailyWellnessSummaryRepository.class);
        DailySleepDataRepository sleepDataRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvDataRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressDataRepository = mock(DailyStressDataRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        CoachRunnerStateRepository coachRunnerStateRepository = mock(CoachRunnerStateRepository.class);
        GoogleHealthImportService service = new GoogleHealthImportService(
                wellnessSummaryRepository,
                sleepDataRepository,
                hrvDataRepository,
                stressDataRepository,
                runnerRepository,
                coachRunnerStateRepository,
                new ObjectMapper()
        );
        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setBaselineRestingHr(49);
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GOOGLE_HEALTH, LocalDate.parse("2026-04-23")))
                .thenReturn(Optional.empty());
        when(coachRunnerStateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        boolean started = service.importWellnessData(runner, List.of(
                Map.of("type", "wellness", "date", "2026-04-23", "restingHeartRate", 53)
        ));

        assertThat(started).isTrue();
        ArgumentCaptor<DailyWellnessSummary> wellnessCaptor = ArgumentCaptor.forClass(DailyWellnessSummary.class);
        verify(wellnessSummaryRepository, timeout(1000)).save(wellnessCaptor.capture());
        assertThat(wellnessCaptor.getValue().getProvider()).isEqualTo(ImportProvider.GOOGLE_HEALTH);
        verify(coachRunnerStateRepository, timeout(1000)).save(state);
        assertThat(state.getLastNightRestingHr()).isEqualTo(53);
        assertThat(state.getBaselineRestingHr()).isEqualTo(49);
    }

    @Test
    void secondAppleImportForSameRunnerIsRejectedWhileFirstImportIsRunning() {
        DailyWellnessSummaryRepository wellnessSummaryRepository = mock(DailyWellnessSummaryRepository.class);
        AppleHealthImportService service = new AppleHealthImportService(
                wellnessSummaryRepository,
                mock(DailySleepDataRepository.class),
                mock(DailyHRVDataRepository.class),
                mock(DailyStressDataRepository.class),
                mock(RunnerRepository.class),
                mock(CoachRunnerStateRepository.class),
                new ObjectMapper()
        );
        Runner runner = runner();
        when(wellnessSummaryRepository.findByRunnerAndProviderAndDate(eq(runner), eq(ImportProvider.APPLE_HEALTH), any(LocalDate.class)))
                .thenAnswer(invocation -> {
                    Thread.sleep(300);
                    return Optional.empty();
                });

        boolean firstStarted = service.importWellnessData(runner, List.of(
                Map.of("type", "wellness", "date", "2026-04-23", "restingHeartRate", 51)
        ));
        boolean secondStarted = service.importWellnessData(runner, List.of());

        assertThat(firstStarted).isTrue();
        assertThat(secondStarted).isFalse();
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(42L);
        runner.setEmail("runner@example.local");
        return runner;
    }
}
