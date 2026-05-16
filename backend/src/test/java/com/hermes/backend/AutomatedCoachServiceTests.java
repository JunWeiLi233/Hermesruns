package com.hermes.backend;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AutomatedCoachServiceTests {

    @Test
    void getTodayWithReadinessCreatesScheduleWhenMissing() {
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        
        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));
        
        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));
        
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>());
        when(scheduleRepository.save(any(CoachScheduledWorkout.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // The real service will save if today's workout is missing from the list
        // and add it to the list.
        s.getTodayWithReadiness(runner);

        verify(scheduleRepository, atLeastOnce()).save(any(CoachScheduledWorkout.class));
    }

    @Test
    void applyReadinessGateDowngradesHardRunsOnLowSleep() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        
        Runner runner = runner();

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastSleepScore(45);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setRunner(runner);
        workout.setWorkoutType(CoachWorkoutType.INTERVALS);
        workout.setPlannedDistanceKm(10.0);
        workout.setScheduledDate(LocalDate.now());

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(workout)));
        
        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));

        AutomatedCoachService.CoachTodayDto today = s.getTodayWithReadiness(runner);

        assertThat(today.today().workoutType()).isEqualTo(CoachWorkoutType.EASY.name());
        assertThat(today.today().mutatedFrom()).isEqualTo(CoachWorkoutType.INTERVALS.name());
        assertThat(today.today().readinessAdjusted()).isTrue();
    }

    @Test
    void getScheduleAppliesRecoveryReadinessGateToTodaysQualityWorkout() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);

        Runner runner = runner();

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastSleepScore(45);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout todayWorkout = new CoachScheduledWorkout();
        todayWorkout.setRunner(runner);
        todayWorkout.setWorkoutType(CoachWorkoutType.INTERVALS);
        todayWorkout.setPlannedDistanceKm(10.0);
        todayWorkout.setScheduledDate(LocalDate.now());

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(todayWorkout)));

        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));

        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = s.getSchedule(runner, 1);

        assertThat(schedule).hasSize(1);
        AutomatedCoachService.CoachScheduledWorkoutDto today = schedule.get(0);
        assertThat(today.workoutType()).isEqualTo(CoachWorkoutType.EASY.name());
        assertThat(today.mutatedFrom()).isEqualTo(CoachWorkoutType.INTERVALS.name());
        assertThat(today.readinessAdjusted()).isTrue();
    }

    @Test
    void getScheduleAppliesRestReadinessGateToTodaysQualityWorkout() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);

        Runner runner = runner();

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastSleepScore(40);
        state.setLastHrvStatus("LOW");
        state.setBaselineRestingHr(50);
        state.setLastNightRestingHr(60);
        state.setLastStressScore(85);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout todayWorkout = new CoachScheduledWorkout();
        todayWorkout.setRunner(runner);
        todayWorkout.setWorkoutType(CoachWorkoutType.THRESHOLD);
        todayWorkout.setPlannedDistanceKm(12.0);
        todayWorkout.setScheduledDate(LocalDate.now());

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(todayWorkout)));

        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));

        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = s.getSchedule(runner, 1);

        assertThat(schedule).hasSize(1);
        AutomatedCoachService.CoachScheduledWorkoutDto today = schedule.get(0);
        assertThat(today.workoutType()).isEqualTo(CoachWorkoutType.RECOVERY.name());
        assertThat(today.mutatedFrom()).isEqualTo(CoachWorkoutType.THRESHOLD.name());
        assertThat(today.readinessAdjusted()).isTrue();
    }

    @Test
    void getScheduleUsesPreferredMultiSourceReadinessForTodaysGate() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        DailySleepDataRepository sleepRepository = mock(DailySleepDataRepository.class);
        DailyHRVDataRepository hrvRepository = mock(DailyHRVDataRepository.class);
        DailyStressDataRepository stressRepository = mock(DailyStressDataRepository.class);
        DailyWellnessSummaryRepository wellnessRepository = mock(DailyWellnessSummaryRepository.class);

        Runner runner = runner();
        runner.setWellnessSleepSource("GARMIN");
        runner.setWellnessHrvSource("APPLE_HEALTH");
        runner.setWellnessStressSource("GARMIN");
        runner.setWellnessRestingHrSource("GARMIN");

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastSleepScore(40);
        state.setLastHrvStatus("LOW");
        state.setBaselineRestingHr(50);
        state.setLastNightRestingHr(60);
        state.setLastStressScore(85);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        LocalDate today = LocalDate.now();
        CoachScheduledWorkout todayWorkout = new CoachScheduledWorkout();
        todayWorkout.setRunner(runner);
        todayWorkout.setWorkoutType(CoachWorkoutType.INTERVALS);
        todayWorkout.setPlannedDistanceKm(10.0);
        todayWorkout.setScheduledDate(today);

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(todayWorkout)));
        when(sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(sleep(today, ImportProvider.APPLE_HEALTH, 45), sleep(today, ImportProvider.GARMIN, 100)));
        when(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(hrv(today, ImportProvider.GARMIN, 42.0, "LOW"), hrv(today, ImportProvider.APPLE_HEALTH, 88.0, "BALANCED")));
        when(stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(stress(today, ImportProvider.GARMIN, 0)));
        when(wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, today, today))
                .thenReturn(List.of(wellness(today, ImportProvider.GARMIN, 47)));

        AutomatedCoachService s = service(
                stateRepository,
                scheduleRepository,
                mock(CoachTrainingBlockRepository.class),
                new ReadinessService(sleepRepository, hrvRepository, stressRepository, wellnessRepository)
        );

        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = s.getSchedule(runner, 1);

        assertThat(schedule).hasSize(1);
        AutomatedCoachService.CoachScheduledWorkoutDto todayDto = schedule.get(0);
        assertThat(todayDto.workoutType()).isEqualTo(CoachWorkoutType.INTERVALS.name());
        assertThat(todayDto.readinessAdjusted()).isFalse();
        assertThat(state.getReadinessScore()).isEqualTo(92);
        assertThat(state.getReadinessVerdict()).isEqualTo("GO");
    }

    @Test
    void getTodayWithReadinessThreadsScheduledTrailSurfaceIntoShoeRecommendation() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        ShoeTracker shoeTracker = mock(ShoeTracker.class);

        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout todayWorkout = new CoachScheduledWorkout();
        todayWorkout.setRunner(runner);
        todayWorkout.setWorkoutType(CoachWorkoutType.EASY);
        todayWorkout.setPlannedDistanceKm(8.0);
        todayWorkout.setScheduledDate(LocalDate.now());
        todayWorkout.setNotes("Trail route on soft surface");

        Shoe trailShoe = new Shoe();
        trailShoe.setId(42L);
        trailShoe.setRunner(runner);
        trailShoe.setBrand("Saucony");
        trailShoe.setModel("Peregrine 14");
        trailShoe.setType("trail");
        trailShoe.setSurfaceType("trail");
        trailShoe.setCurrentDistanceKm(30.0);
        trailShoe.setMaxDistanceKm(650.0);
        trailShoe.setDaysSinceLastWear(6);

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(todayWorkout)));
        when(shoeTracker.recommendShoe(runner, CoachWorkoutType.EASY, "trail")).thenReturn(Optional.of(trailShoe));

        AutomatedCoachService s = service(
                stateRepository,
                scheduleRepository,
                mock(CoachTrainingBlockRepository.class),
                new ReadinessService(
                        mock(DailySleepDataRepository.class),
                        mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class),
                        mock(DailyWellnessSummaryRepository.class)
                ),
                shoeTracker
        );

        AutomatedCoachService.CoachTodayDto today = s.getTodayWithReadiness(runner);

        verify(shoeTracker).recommendShoe(runner, CoachWorkoutType.EASY, "trail");
        assertThat(today.recommendedShoe()).isNotNull();
        assertThat(today.recommendedShoe().id()).isEqualTo(42L);
        assertThat(today.recommendedShoe().surfaceType()).isEqualTo("trail");
        assertThat(today.recommendedShoe().daysSinceLastWear()).isEqualTo(6);
        assertThat(today.recommendedShoe().recommendationReason()).contains("trail surface");
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository
    ) {
        return service(
                stateRepository,
                scheduleRepository,
                blockRepository,
                new ReadinessService(
                        mock(DailySleepDataRepository.class),
                        mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class),
                        mock(DailyWellnessSummaryRepository.class)
                )
        );
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            ReadinessService readinessService
    ) {
        return service(stateRepository, scheduleRepository, blockRepository, readinessService, mock(ShoeTracker.class));
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            ReadinessService readinessService,
            ShoeTracker shoeTracker
    ) {
        return new AutomatedCoachService(
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                stateRepository,
                scheduleRepository,
                blockRepository,
                mock(CoachFeedbackAlertRepository.class),
                shoeTracker,
                mock(CoachRouteService.class),
                readinessService
        );
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

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}
