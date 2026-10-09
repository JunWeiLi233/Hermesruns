package com.hermes.backend.runner;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunMetricsProjection;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TrainingZonesServiceTests {

    private RunnerRepository runners;
    private RunnerTrainingZonesRepository zoneRows;
    private ActivityRepository activities;
    private ApplicationEventPublisher events;
    private TrainingZonesService service;
    private Runner runner;

    @BeforeEach
    void setUp() {
        runners = mock(RunnerRepository.class);
        zoneRows = mock(RunnerTrainingZonesRepository.class);
        activities = mock(ActivityRepository.class);
        events = mock(ApplicationEventPublisher.class);
        service = new TrainingZonesService(runners, zoneRows, activities, events, "60,70,80,90");
        runner = new Runner();
        runner.setId(7L);
        when(zoneRows.findByRunner(runner)).thenReturn(Optional.empty());
    }

    private static RunMetricsProjection runWithPeak(Double maxHeartRate) {
        RunMetricsProjection run = mock(RunMetricsProjection.class);
        when(run.getMaxHeartRate()).thenReturn(maxHeartRate);
        return run;
    }

    private void runnerHasPeaks(double... peaks) {
        List<RunMetricsProjection> runs = new ArrayList<>();
        for (double peak : peaks) {
            runs.add(runWithPeak(peak));
        }
        when(activities.findRunMetricsBetween(eq(runner), eq(ActivityType.RUN), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(runs);
    }

    // --- configured percentages ----------------------------------------------------------------------------------

    @Test
    void configuredPercentagesAreUsedWhenTheyMakeSense() {
        assertThat(TrainingZonesService.parsePercentages("55, 65, 75, 85")).containsExactly(55, 65, 75, 85);
    }

    @Test
    void nonsenseConfigurationFallsBackToTheStandardPercentages() {
        int[] standard = {60, 70, 80, 90};
        assertThat(TrainingZonesService.parsePercentages("60,70,80")).containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("60,70,80,90,95")).containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("60,60,80,90")).as("not increasing").containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("60,70,80,100")).as("a boundary at max is no zone").containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("0,70,80,90")).containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("a,b,c,d")).containsExactly(standard);
        assertThat(TrainingZonesService.parsePercentages("")).containsExactly(standard);
    }

    // --- resolving -------------------------------------------------------------------------------------------------

    @Test
    void aRunnerWithNothingSetGetsTheDefaultMaxHeartRateAndAutomaticBoundaries() {
        TrainingZonesService.ResolvedZones resolved = service.resolve(runner);

        assertThat(resolved.zones().maxHeartRate()).isEqualTo(190);
        assertThat(resolved.maxHeartRateSource()).isEqualTo(HeartRateZones.MAX_SOURCE_DEFAULT);
        assertThat(resolved.boundarySource()).isEqualTo(HeartRateZones.SOURCE_AUTO);
        assertThat(resolved.zones().boundaries()).containsExactly(114, 133, 152, 171);
    }

    @Test
    void theProfileMaxHeartRateIsUsedWhenItIsInRange() {
        runner.setMaxHeartRateBpm(170);

        TrainingZonesService.ResolvedZones resolved = service.resolve(runner);

        assertThat(resolved.zones().maxHeartRate()).isEqualTo(170);
        assertThat(resolved.maxHeartRateSource()).isEqualTo(HeartRateZones.MAX_SOURCE_PROFILE);
    }

    @Test
    void aStoredMaxHeartRateOutOfRangeIsIgnoredInsteadOfBuildingNonsenseZones() {
        runner.setMaxHeartRateBpm(100);
        assertThat(service.resolve(runner).zones().maxHeartRate()).isEqualTo(190);
        runner.setMaxHeartRateBpm(260);
        assertThat(service.resolve(runner).maxHeartRateSource()).isEqualTo(HeartRateZones.MAX_SOURCE_DEFAULT);
    }

    @Test
    void manualBoundariesWinAndDoNotDependOnTheMaxHeartRate() {
        runner.setMaxHeartRateBpm(170);
        RunnerTrainingZones row = new RunnerTrainingZones(runner);
        row.setManualBoundaries(new int[] {100, 120, 140, 160});
        when(zoneRows.findByRunner(runner)).thenReturn(Optional.of(row));

        TrainingZonesService.ResolvedZones resolved = service.resolve(runner);

        assertThat(resolved.boundarySource()).isEqualTo(HeartRateZones.SOURCE_MANUAL);
        assertThat(resolved.zones().boundaries()).containsExactly(100, 120, 140, 160);
        assertThat(resolved.zones().maxHeartRate()).isEqualTo(170);
    }

    @Test
    void damagedManualBoundariesFallBackToAutomaticOnes() {
        RunnerTrainingZones row = new RunnerTrainingZones(runner);
        row.setManualBoundaries(new int[] {150, 140, 130, 120}); // never valid; as if edited in the database
        when(zoneRows.findByRunner(runner)).thenReturn(Optional.of(row));

        TrainingZonesService.ResolvedZones resolved = service.resolve(runner);

        assertThat(resolved.boundarySource()).isEqualTo(HeartRateZones.SOURCE_AUTO);
        assertThat(resolved.zones().boundaries()).containsExactly(114, 133, 152, 171);
    }

    // --- suggesting a max heart rate -------------------------------------------------------------------------------

    @Test
    void theSuggestionIsTheNinetyFifthPercentileOfTheRunsPeaks() {
        // 20 peaks, 160 to 179: the nearest-rank 95th percentile is the 19th value, 178.
        runnerHasPeaks(IntStream.rangeClosed(160, 179).asDoubleStream().toArray());

        assertThat(service.suggestMaxHeartRate(runner))
                .contains(new TrainingZonesService.MaxHeartRateSuggestion(178, 20));
    }

    @Test
    void oneSpikingSensorDoesNotSetTheSuggestion() {
        double[] peaks = IntStream.rangeClosed(160, 179).asDoubleStream().toArray();
        peaks[19] = 229; // one run with a strap glitch at the very top of the range
        runnerHasPeaks(peaks);

        assertThat(service.suggestMaxHeartRate(runner).orElseThrow().bpm()).isEqualTo(178);
    }

    @Test
    void peaksThatCannotBeRealAreLeftOut() {
        double[] peaks = new double[24];
        for (int i = 0; i < 20; i++) {
            peaks[i] = 170;
        }
        peaks[20] = 139;  // too low to be a peak
        peaks[21] = 231;  // above any human maximum
        peaks[22] = 0;
        peaks[23] = 300;
        runnerHasPeaks(peaks);

        assertThat(service.suggestMaxHeartRate(runner)).contains(new TrainingZonesService.MaxHeartRateSuggestion(170, 20));
    }

    @Test
    void tooFewRunsMeansNoSuggestion() {
        runnerHasPeaks(IntStream.rangeClosed(160, 178).asDoubleStream().toArray()); // 19

        assertThat(service.suggestMaxHeartRate(runner)).isEmpty();
    }

    @Test
    void runsWithNoRecordedPeakDoNotCount() {
        List<RunMetricsProjection> runs = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            runs.add(runWithPeak(null));
        }
        when(activities.findRunMetricsBetween(eq(runner), eq(ActivityType.RUN), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(runs);

        assertThat(service.suggestMaxHeartRate(runner)).isEmpty();
    }

    // --- updating --------------------------------------------------------------------------------------------------

    @Test
    void aChangeThatMovesTheZonesIsSavedAndAnnounced() {
        TrainingZonesService.UpdateResult result = service.update(runner, new TrainingZonesService.Update(180, false, null, false));

        assertThat(result.changed()).isTrue();
        assertThat(result.zones().zones().maxHeartRate()).isEqualTo(180);
        assertThat(runner.getMaxHeartRateBpm()).isEqualTo(180);
        verify(runners).save(runner);
        verify(events).publishEvent(new RunnerZonesChangedEvent(7L));
    }

    @Test
    void aChangeThatLeavesTheZonesAloneIsNotAnnounced() {
        runner.setMaxHeartRateBpm(180);

        TrainingZonesService.UpdateResult result = service.update(runner, new TrainingZonesService.Update(180, false, null, false));

        assertThat(result.changed()).isFalse();
        verify(events, never()).publishEvent(any(Object.class));
    }

    @Test
    void settingBoundariesAndResettingThemMoveTheZonesBothWays() {
        // A saved row is what the next lookup finds, as in the real repository.
        when(zoneRows.save(any(RunnerTrainingZones.class))).thenAnswer(call -> {
            RunnerTrainingZones saved = call.getArgument(0);
            when(zoneRows.findByRunner(runner)).thenReturn(Optional.of(saved));
            return saved;
        });

        service.update(runner, new TrainingZonesService.Update(null, false, new int[] {100, 120, 140, 160}, false));
        verify(zoneRows).save(any(RunnerTrainingZones.class));
        verify(events).publishEvent(new RunnerZonesChangedEvent(7L));

        // Now the runner with those boundaries asks for the automatic ones back.
        RunnerTrainingZones row = zoneRows.findByRunner(runner).orElseThrow();
        assertThat(row.isManual()).isTrue();
        TrainingZonesService.UpdateResult reset = service.update(runner, new TrainingZonesService.Update(null, false, null, true));

        assertThat(reset.changed()).isTrue();
        assertThat(row.isManual()).isFalse();
        assertThat(reset.zones().boundarySource()).isEqualTo(HeartRateZones.SOURCE_AUTO);
    }

    @Test
    void goingBackToTheDefaultMaxHeartRateClearsTheProfileValue() {
        runner.setMaxHeartRateBpm(170);

        TrainingZonesService.UpdateResult result = service.update(runner, new TrainingZonesService.Update(null, true, null, false));

        assertThat(runner.getMaxHeartRateBpm()).isNull();
        assertThat(result.zones().zones().maxHeartRate()).isEqualTo(190);
        assertThat(result.changed()).isTrue();
    }

    @Test
    void refusedChangesTouchNothing() {
        runner.setMaxHeartRateBpm(170);
        List<TrainingZonesService.Update> refused = List.of(
                new TrainingZonesService.Update(119, false, null, false),
                new TrainingZonesService.Update(231, false, null, false),
                new TrainingZonesService.Update(180, true, null, false),
                new TrainingZonesService.Update(null, false, new int[] {1, 2, 3, 4}, false),
                new TrainingZonesService.Update(null, false, new int[] {100, 120, 140, 160}, true),
                new TrainingZonesService.Update(190, false, new int[] {100, 120, 140}, false));

        for (TrainingZonesService.Update update : refused) {
            assertThatThrownBy(() -> service.update(runner, update)).isInstanceOf(IllegalArgumentException.class);
        }

        assertThat(runner.getMaxHeartRateBpm()).isEqualTo(170);
        verify(runners, never()).save(any(Runner.class));
        verify(zoneRows, never()).save(any(RunnerTrainingZones.class));
        verify(events, never()).publishEvent(any(Object.class));
    }
}
