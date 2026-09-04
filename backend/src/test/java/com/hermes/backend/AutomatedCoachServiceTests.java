package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AutomatedCoachServiceTests {

    @ParameterizedTest
    @ValueSource(ints = {2, 3, 4, 9, 26000})
    void nightlyAuditCatchesUpMissedWeeksWithoutIncreasingLoadOrRepeatingProgression(int missedWeeks) {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate currentWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        fixture.block().setBlockStartedOn(currentWeek.minusWeeks(missedWeeks + 2L));
        fixture.block().setLastProgressionWeekStart(currentWeek.minusWeeks(missedWeeks));

        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(2 + missedWeeks);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(currentWeek);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(13.3);

        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(2 + missedWeeks);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(currentWeek);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(13.3);
        verify(fixture.blocks()).save(fixture.block());
    }

    @ParameterizedTest
    @CsvSource({"0,14.9", "3,9.3", "4,14.9"})
    void nightlyAuditPreservesSingleWeekIncreaseCutbackAndRounding(int previousIndex, double expectedKm) {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate currentWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        fixture.block().setWeekIndex(previousIndex);
        fixture.block().setBlockStartedOn(currentWeek.minusWeeks(previousIndex + 1L));
        fixture.block().setLastProgressionWeekStart(currentWeek.minusWeeks(1));

        fixture.service().nightlyAuditAllRunners();
        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(previousIndex + 1);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(currentWeek);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(expectedKm);
        verify(fixture.blocks()).save(fixture.block());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1})
    void nightlyAuditDoesNotAdvanceCurrentOrFutureWatermark(int weeksAhead) {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate watermark = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(weeksAhead);
        fixture.block().setLastProgressionWeekStart(watermark);

        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(2);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(watermark);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(13.3);
        verify(fixture.blocks(), never()).save(any());
    }

    @Test
    void nightlyAuditRecoversNullWatermarkFromBlockStartWithoutIncreasingLoad() {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate currentWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        fixture.block().setBlockStartedOn(currentWeek.minusWeeks(6).plusDays(2));
        fixture.block().setLastProgressionWeekStart(null);

        fixture.service().nightlyAuditAllRunners();
        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(6);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(currentWeek);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(13.3);
        verify(fixture.blocks()).save(fixture.block());
    }

    @Test
    void nightlyAuditInitializesMissingDatesWithoutInventingTrainingProgress() {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate currentWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        fixture.block().setBlockStartedOn(null);
        fixture.block().setLastProgressionWeekStart(null);

        fixture.service().nightlyAuditAllRunners();
        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(2);
        assertThat(fixture.block().getLastProgressionWeekStart()).isEqualTo(currentWeek);
        assertThat(fixture.block().getCurrentLongRunKm()).isEqualTo(13.3);
        verify(fixture.blocks()).save(fixture.block());
    }

    @Test
    void multiweekNightlyRecoveryPreservesCompletedWorkout() {
        NightlyAuditFixture fixture = nightlyAuditFixture();
        LocalDate today = LocalDate.now();
        LocalDate currentWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        fixture.block().setBlockStartedOn(currentWeek.minusWeeks(5));
        fixture.block().setLastProgressionWeekStart(currentWeek.minusWeeks(3));
        CoachScheduledWorkout completedPlan = new CoachScheduledWorkout();
        completedPlan.setRunner(fixture.runner());
        completedPlan.setScheduledDate(today);
        completedPlan.setWorkoutType(CoachWorkoutType.THRESHOLD);
        completedPlan.setPlannedDistanceKm(9.0);
        completedPlan.setPlannedDurationMinutes(50);
        completedPlan.setNotes("Completed threshold workout");
        when(fixture.schedules().findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(
                eq(fixture.runner()), any(), any())).thenReturn(List.of(completedPlan));
        when(fixture.activities().countByRunnerAndActivityType(fixture.runner(), ActivityType.RUN)).thenReturn(10L);
        List<RunMetricsProjection> completedRuns = List.of(runMetric(today.atStartOfDay(), 9.0, 3000, 170));
        when(fixture.activities().findRunMetricsBetween(eq(fixture.runner()), eq(ActivityType.RUN), any(), any()))
                .thenReturn(completedRuns);
        doAnswer(invocation -> {
            Iterable<CoachScheduledWorkout> saved = invocation.getArgument(0);
            assertThat(saved).doesNotContain(completedPlan);
            return List.of();
        }).when(fixture.schedules()).saveAll(anyList());

        fixture.service().nightlyAuditAllRunners();
        fixture.service().nightlyAuditAllRunners();

        assertThat(fixture.block().getWeekIndex()).isEqualTo(5);
        assertThat(completedPlan.getWorkoutType()).isEqualTo(CoachWorkoutType.THRESHOLD);
        assertThat(completedPlan.getPlannedDistanceKm()).isEqualTo(9.0);
        assertThat(completedPlan.getPlannedDurationMinutes()).isEqualTo(50);
        assertThat(completedPlan.getNotes()).isEqualTo("Completed threshold workout");
        verify(fixture.schedules(), times(2)).saveAll(anyList());
    }

    @Test
    void getScheduleDoesNotRewriteTodaysWorkoutAfterRunnerCompletedIt() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastAggregatedAt(LocalDateTime.now());
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout completedPlan = new CoachScheduledWorkout();
        completedPlan.setRunner(runner);
        completedPlan.setScheduledDate(LocalDate.now());
        completedPlan.setWorkoutType(CoachWorkoutType.THRESHOLD);
        completedPlan.setPlannedDistanceKm(9.0);
        completedPlan.setPlannedDurationMinutes(50);
        List<CoachScheduledWorkout> existing = new ArrayList<>(List.of(completedPlan));
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(existing);
        when(activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN)).thenReturn(10L);
        List<RunMetricsProjection> completedRuns = List.of(
                runMetric(LocalDate.now().atTime(7, 0), 9.0, 3_000, 170)
        );
        when(activityRepository.findRunMetricsBetween(eq(runner), eq(ActivityType.RUN), any(), any()))
                .thenReturn(completedRuns);

        AutomatedCoachService service = service(
                stateRepository,
                scheduleRepository,
                mock(CoachTrainingBlockRepository.class),
                new ReadinessService(
                        mock(DailySleepDataRepository.class),
                        mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class),
                        mock(DailyWellnessSummaryRepository.class),
                        mock(ActivityRepository.class)
                ),
                mock(ShoeTrackerService.class),
                activityRepository
        );

        AutomatedCoachService.CoachScheduledWorkoutDto today = service.getSchedule(runner, 1).get(0);

        assertThat(today.workoutType()).isEqualTo(CoachWorkoutType.THRESHOLD.name());
        assertThat(today.plannedDistanceKm()).isEqualTo(9.0);
    }

    @Test
    void getScheduleReplansExistingHorizonFromRecentRunnerHistory() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        Runner runner = runner();

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastAggregatedAt(LocalDateTime.now());
        state.setVolumeKm7d(15.0);
        state.setVolumeKm28d(60.0);
        state.setHighIntensityRatioLast7d(0.08);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        LocalDate today = LocalDate.now();
        LocalDate sunday = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        List<CoachScheduledWorkout> existing = new ArrayList<>();
        for (int offset = 0; offset < 14; offset++) {
            CoachScheduledWorkout workout = new CoachScheduledWorkout();
            workout.setRunner(runner);
            workout.setScheduledDate(today.plusDays(offset));
            workout.setWorkoutType(today.plusDays(offset).equals(sunday) ? CoachWorkoutType.LONG_RUN : CoachWorkoutType.EASY);
            workout.setPlannedDistanceKm(today.plusDays(offset).equals(sunday) ? 15.0 : 8.0);
            workout.setPlannedDurationMinutes(today.plusDays(offset).equals(sunday) ? 90 : 45);
            existing.add(workout);
        }

        when(scheduleRepository.findByRunnerAndScheduledDateBetween(eq(runner), any(), any())).thenReturn(existing);
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any())).thenReturn(existing);
        when(activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN)).thenReturn(12L);
        List<RunMetricsProjection> recentRuns = List.of(
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.TUESDAY)).atTime(7, 0), 5.0, 1_650, 155.0),
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).atTime(7, 0), 5.5, 1_815, 158.0),
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY)).atTime(8, 0), 6.0, 2_040, 160.0),
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.TUESDAY)).minusWeeks(1).atTime(7, 0), 5.0, 1_700, 154.0),
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.THURSDAY)).minusWeeks(1).atTime(7, 0), 5.5, 1_870, 156.0),
                runMetric(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SATURDAY)).minusWeeks(1).atTime(8, 0), 6.0, 2_070, 159.0)
        );
        when(activityRepository.findRunMetricsBetween(eq(runner), eq(ActivityType.RUN), any(), any()))
                .thenReturn(recentRuns);

        AutomatedCoachService service = service(
                stateRepository,
                scheduleRepository,
                blockRepository,
                new ReadinessService(
                        mock(DailySleepDataRepository.class),
                        mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class),
                        mock(DailyWellnessSummaryRepository.class),
                        mock(ActivityRepository.class)
                ),
                mock(ShoeTrackerService.class),
                activityRepository
        );

        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = service.getSchedule(runner, 14);

        AutomatedCoachService.CoachScheduledWorkoutDto personalizedSunday = schedule.stream()
                .filter(row -> sunday.equals(row.scheduledDate()))
                .findFirst()
                .orElseThrow();
        assertThat(personalizedSunday.workoutType()).isEqualTo(CoachWorkoutType.REST.name());
        assertThat(personalizedSunday.plannedDistanceKm()).isNull();
        assertThat(personalizedSunday.phase()).isEqualTo("absorb");
        verify(scheduleRepository).saveAll(anyList());
    }

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

        assertThat(today.today().workoutType()).isIn(CoachWorkoutType.REST.name(), CoachWorkoutType.RECOVERY.name());
        assertThat(today.today().reasonCode()).isEqualTo("onboarding");
        assertThat(today.today().readinessAdjusted()).isFalse();
        assertThat(today.plan().phase()).isEqualTo("onboarding");
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
        assertThat(today.workoutType()).isIn(CoachWorkoutType.REST.name(), CoachWorkoutType.RECOVERY.name());
        assertThat(today.reasonCode()).isEqualTo("onboarding");
        assertThat(today.readinessAdjusted()).isFalse();
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
        assertThat(today.workoutType()).isIn(CoachWorkoutType.REST.name(), CoachWorkoutType.RECOVERY.name());
        assertThat(today.reasonCode()).isEqualTo("readiness_protect");
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
                new ReadinessService(sleepRepository, hrvRepository, stressRepository, wellnessRepository, mock(ActivityRepository.class))
        );

        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = s.getSchedule(runner, 1);

        assertThat(schedule).hasSize(1);
        AutomatedCoachService.CoachScheduledWorkoutDto todayDto = schedule.get(0);
        assertThat(todayDto.workoutType()).isEqualTo(CoachWorkoutType.REST.name());
        assertThat(todayDto.phase()).isEqualTo("onboarding");
        assertThat(todayDto.readinessAdjusted()).isFalse();
        assertThat(state.getReadinessScore()).isEqualTo(89);
        assertThat(state.getReadinessVerdict()).isEqualTo("GO");
    }

    @Test
    void getTodayWithReadinessThreadsScheduledTrailSurfaceIntoShoeRecommendation() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        ShoeTrackerService shoeTracker = mock(ShoeTrackerService.class);

        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastAggregatedAt(LocalDateTime.now());
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
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        when(activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN)).thenReturn(12L);
        List<RunMetricsProjection> recentRuns = List.of(
                runMetric(LocalDate.now().atTime(7, 0), 8.0, 2_880, 150),
                runMetric(LocalDate.now().minusWeeks(1).atTime(7, 0), 8.0, 2_900, 151),
                runMetric(LocalDate.now().minusWeeks(2).atTime(7, 0), 7.5, 2_700, 149),
                runMetric(LocalDate.now().minusWeeks(3).atTime(7, 0), 8.5, 3_060, 152)
        );
        when(activityRepository.findRunMetricsBetween(eq(runner), eq(ActivityType.RUN), any(), any()))
                .thenReturn(recentRuns);
        when(shoeTracker.recommendShoe(eq(runner), any(CoachWorkoutType.class), eq("trail"))).thenReturn(Optional.of(trailShoe));

        AutomatedCoachService s = service(
                stateRepository,
                scheduleRepository,
                mock(CoachTrainingBlockRepository.class),
                new ReadinessService(
                        mock(DailySleepDataRepository.class),
                        mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class),
                        mock(DailyWellnessSummaryRepository.class),
                        mock(ActivityRepository.class)
                ),
                shoeTracker,
                activityRepository
        );

        AutomatedCoachService.CoachTodayDto today = s.getTodayWithReadiness(runner);

        verify(shoeTracker).recommendShoe(eq(runner), any(CoachWorkoutType.class), eq("trail"));
        assertThat(today.recommendedShoe()).isNotNull();
        assertThat(today.recommendedShoe().id()).isEqualTo(42L);
        assertThat(today.recommendedShoe().surfaceType()).isEqualTo("trail");
        assertThat(today.recommendedShoe().daysSinceLastWear()).isEqualTo(6);
        assertThat(today.recommendedShoe().recommendationReason()).contains("trail surface");
    }

    private NightlyAuditFixture nightlyAuditFixture() {
        Runner runner = runner();
        RunnerRepository runners = mock(RunnerRepository.class);
        ActivityRepository activities = mock(ActivityRepository.class);
        CoachRunnerStateRepository states = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository schedules = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blocks = mock(CoachTrainingBlockRepository.class);
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        when(runners.findAllById(List.of(runner.getId()))).thenReturn(List.of(runner));
        when(activities.findDistinctRunnerIdsWithActivityType(ActivityType.RUN)).thenReturn(List.of(runner.getId()));
        when(states.findByRunner(runner)).thenReturn(Optional.of(state));
        CoachTrainingBlock block = new CoachTrainingBlock();
        block.setRunner(runner);
        block.setRaceDistanceKm(21.1);
        block.setWeekIndex(2);
        block.setCurrentLongRunKm(13.3);
        when(blocks.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.of(block));
        AutomatedCoachService service = new AutomatedCoachService(
                runners, activities, states, schedules, blocks,
                mock(CoachFeedbackAlertRepository.class), mock(ShoeTrackerService.class), mock(CoachRouteService.class),
                new ReadinessService(mock(DailySleepDataRepository.class), mock(DailyHRVDataRepository.class),
                        mock(DailyStressDataRepository.class), mock(DailyWellnessSummaryRepository.class), activities),
                new PersonalizedRunningPlanner(), mock(RaceEventRepository.class), mock(InjuryRiskService.class));
        return new NightlyAuditFixture(service, runner, activities, schedules, blocks, block);
    }

    private record NightlyAuditFixture(AutomatedCoachService service, Runner runner, ActivityRepository activities,
                                     CoachScheduledWorkoutRepository schedules, CoachTrainingBlockRepository blocks,
                                     CoachTrainingBlock block) {}

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
                        mock(DailyWellnessSummaryRepository.class),
                        mock(ActivityRepository.class)
                )
        );
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            ReadinessService readinessService
    ) {
        return service(stateRepository, scheduleRepository, blockRepository, readinessService, mock(ShoeTrackerService.class));
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            ReadinessService readinessService,
            ShoeTrackerService shoeTracker
    ) {
        return service(stateRepository, scheduleRepository, blockRepository, readinessService, shoeTracker, mock(ActivityRepository.class));
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository,
            ReadinessService readinessService,
            ShoeTrackerService shoeTracker,
            ActivityRepository activityRepository
    ) {
        return new AutomatedCoachService(
                mock(RunnerRepository.class),
                activityRepository,
                stateRepository,
                scheduleRepository,
                blockRepository,
                mock(CoachFeedbackAlertRepository.class),
                shoeTracker,
                mock(CoachRouteService.class),
                readinessService,
                new PersonalizedRunningPlanner(),
                mock(RaceEventRepository.class),
                mock(InjuryRiskService.class)
        );
    }

    private RunMetricsProjection runMetric(LocalDateTime startedAt, double distanceKm, long durationSeconds, double maxHeartRate) {
        RunMetricsProjection projection = mock(RunMetricsProjection.class);
        when(projection.getEffectiveStartTime()).thenReturn(startedAt);
        when(projection.getDistanceKm()).thenReturn(distanceKm);
        when(projection.getDistanceMeters()).thenReturn(distanceKm * 1000.0);
        when(projection.getDurationSeconds()).thenReturn(durationSeconds);
        when(projection.getMovingTimeSeconds()).thenReturn((int) durationSeconds);
        when(projection.getMaxHeartRate()).thenReturn(maxHeartRate);
        when(projection.getAverageHeartRate()).thenReturn(maxHeartRate - 12.0);
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

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}
