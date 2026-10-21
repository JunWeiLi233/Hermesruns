package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunMetricsProjection;
import com.hermes.backend.races.RaceEventRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.ShoeTrackerService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Behavioral injection tests: real service; repository I/O isolated, no host clock change. */
class AutomatedCoachClockTests {
    @Test
    void dashboardCalculatesTheFullWeekInsteadOfSummingIncompleteStoredRecommendations() {
        try (Fixture f = new Fixture(Instant.parse("2026-10-17T16:00:00Z"))) {
            f.state.setLastAggregatedAt(LocalDateTime.of(2026, 10, 17, 12, 0));
            var activities = List.of(run(Instant.parse("2026-10-12T12:00:00Z"), 10),
                    run(Instant.parse("2026-10-13T12:00:00Z"), 10.2),
                    run(Instant.parse("2026-10-14T12:00:00Z"), 5.1),
                    run(Instant.parse("2026-10-15T12:00:00Z"), 10),
                    run(Instant.parse("2026-10-10T12:00:00Z"), 8),
                    run(Instant.parse("2026-10-03T12:00:00Z"), 8));
            when(f.activities.findRunMetricsBetween(eq(f.runner), eq(ActivityType.RUN), any(), any())).thenReturn(activities);
            when(f.activities.countByRunnerAndActivityType(f.runner, ActivityType.RUN)).thenReturn(24L);
            CoachScheduledWorkout thursday = new CoachScheduledWorkout();
            thursday.setRunner(f.runner);
            thursday.setScheduledDate(LocalDate.of(2026, 10, 15));
            thursday.setWorkoutType(CoachWorkoutType.EASY);
            thursday.setPlannedDistanceKm(4.5);
            CoachScheduledWorkout saturday = new CoachScheduledWorkout();
            saturday.setRunner(f.runner);
            saturday.setScheduledDate(LocalDate.of(2026, 10, 17));
            saturday.setWorkoutType(CoachWorkoutType.REST);
            when(f.schedules.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(f.runner), any(), any()))
                    .thenAnswer(invocation -> {
                        LocalDate start = invocation.getArgument(1);
                        LocalDate end = invocation.getArgument(2);
                        return List.of(thursday, saturday).stream()
                                .filter(row -> !row.getScheduledDate().isBefore(start) && !row.getScheduledDate().isAfter(end)).toList();
                    });
            var response = f.service.getTodayWithReadiness(f.runner, false);
            assertThat(response.weekSchedule()).hasSize(7);
            assertThat(response.weekSchedule().stream().filter(day -> day.plannedDistanceKm() != null)
                    .mapToLong(day -> Math.round(day.plannedDistanceKm() * 10)).sum())
                    .isLessThanOrEqualTo(Math.round(response.plan().targetWeeklyKm() * 10));
            assertThat(response.today().workoutType()).isEqualTo("REST");
            assertThat(response.weekSchedule()).filteredOn(day -> day.scheduledDate().equals(response.today().scheduledDate()))
                    .containsExactly(response.today());
            for (var day : response.schedule()) {
                if (day.scheduledDate().isAfter(LocalDate.of(2026, 10, 18))) continue;
                assertThat(response.weekSchedule()).filteredOn(weekDay -> weekDay.scheduledDate().equals(day.scheduledDate()))
                        .containsExactly(day);
            }
            assertThat(response.weekSchedule()).anyMatch(day -> day.scheduledDate().isBefore(LocalDate.of(2026, 10, 17))
                    && day.plannedDistanceKm() != null && day.plannedDistanceKm() > 0);
            assertThat(response.schedule()).allMatch(day -> !day.scheduledDate().isBefore(LocalDate.of(2026, 10, 17)));
            assertThat(thursday.getPlannedDistanceKm()).isEqualTo(4.5);
        }
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-11T03:59:50Z,2026-10-11T04:00:10Z,2026-10-10,2026-10-11",
            "2026-03-08T06:59:50Z,2026-03-08T07:00:10Z,2026-03-08,2026-03-08",
            "2026-11-01T05:59:50Z,2026-11-01T06:00:10Z,2026-11-01,2026-11-01"
    })
    void scheduleAndReadinessFollowTheInjectedAccountCalendar(
            String before, String after, String beforeDate, String afterDate) {
        try (Fixture f = new Fixture(Instant.parse(before))) {
            f.state.setLastAggregatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
            when(f.schedules.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(f.runner), any(), any()))
                    .thenAnswer(invocation -> {
                        CoachScheduledWorkout row = new CoachScheduledWorkout();
                        row.setRunner(f.runner);
                        row.setScheduledDate(invocation.getArgument(1));
                        row.setWorkoutType(CoachWorkoutType.REST);
                        return List.of(row);
                    });
            assertThat(f.service.getSchedulePreservingSchedule(f.runner, 1).get(0).scheduledDate())
                    .isEqualTo(LocalDate.parse(beforeDate));
            f.clock.setInstant(Instant.parse(after));
            assertThat(f.service.getSchedulePreservingSchedule(f.runner, 1).get(0).scheduledDate())
                    .isEqualTo(LocalDate.parse(afterDate));
            f.service.getCoachStatePreservingSchedule(f.runner);
            verify(f.readiness).resolveReadinessSnapshot(f.runner, f.state, LocalDate.parse(afterDate));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-03-08T07:05:00Z", "2026-11-01T06:05:00Z", "2026-10-11T04:05:00Z"})
    void rollingAggregatesKeepExactElapsedCutoffsAcrossDstAndMidnight(String timestamp) {
        Instant now = Instant.parse(timestamp);
        try (Fixture f = new Fixture(now)) {
            List<RunMetricsProjection> rows = List.of(
                    run(now.minus(7, ChronoUnit.DAYS).minusSeconds(1), 1),
                    run(now.minus(7, ChronoUnit.DAYS), 2),
                    run(now.minus(28, ChronoUnit.DAYS), 4),
                    run(now.minus(28, ChronoUnit.DAYS).minusSeconds(1), 16),
                    run(now, 8),
                    run(now.plusSeconds(1), 32));
            when(f.activities.findRunMetricsBetween(eq(f.runner), eq(ActivityType.RUN), any(), any()))
                    .thenReturn(rows);
            AutomatedCoachService.CoachStateDto actual = f.service.getCoachStatePreservingSchedule(f.runner);
            assertThat(actual.volumeKm7d()).isEqualTo(10);
            assertThat(actual.volumeKm28d()).isEqualTo(15);
            assertThat(actual.minutesUnknownHrLast7d()).isEqualTo(2);
            assertThat(f.state.getLastAggregatedAt()).isEqualTo(LocalDateTime.ofInstant(now, ZoneOffset.UTC));
            verify(f.activities).findRunMetricsBetween(f.runner, ActivityType.RUN,
                    LocalDateTime.ofInstant(now.minus(90, ChronoUnit.DAYS), ZoneOffset.UTC).minusDays(1),
                    LocalDateTime.ofInstant(now, ZoneOffset.UTC).plusDays(1));
        }
    }

    private static RunMetricsProjection run(Instant instant, double km) {
        RunMetricsProjection run = mock(RunMetricsProjection.class);
        LocalDateTime utc = LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
        when(run.getEffectiveStartTime()).thenReturn(utc);
        when(run.getStartTime()).thenReturn(utc);
        when(run.getStravaApiSourced()).thenReturn(false);
        when(run.getDistanceKm()).thenReturn(km);
        when(run.getDurationSeconds()).thenReturn(60L);
        return run;
    }

    private static final class Fixture implements AutoCloseable {
        final Runner runner = new Runner();
        final CoachRunnerState state = new CoachRunnerState();
        final MutableCoachClock clock;
        final ActivityRepository activities = mock(ActivityRepository.class);
        final CoachScheduledWorkoutRepository schedules = mock(CoachScheduledWorkoutRepository.class);
        final CoachRunnerStateRepository states = mock(CoachRunnerStateRepository.class);
        final ReadinessService readiness = mock(ReadinessService.class);
        final AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        final AutomatedCoachService service;

        Fixture(Instant instant) {
            runner.setId(93004L);
            runner.setTimeZone("America/New_York");
            state.setRunner(runner);
            clock = new MutableCoachClock(instant);
            when(states.findByRunner(runner)).thenReturn(Optional.of(state));
            context.registerBean(Clock.class, () -> clock);
            context.registerBean(RunnerRepository.class, () -> mock(RunnerRepository.class));
            context.registerBean(ActivityRepository.class, () -> activities);
            context.registerBean(CoachRunnerStateRepository.class, () -> states);
            context.registerBean(CoachScheduledWorkoutRepository.class, () -> schedules);
            context.registerBean(CoachTrainingBlockRepository.class, () -> mock(CoachTrainingBlockRepository.class));
            context.registerBean(CoachFeedbackAlertRepository.class, () -> mock(CoachFeedbackAlertRepository.class));
            context.registerBean(ShoeTrackerService.class, () -> mock(ShoeTrackerService.class));
            context.registerBean(CoachRouteService.class, () -> mock(CoachRouteService.class));
            context.registerBean(ReadinessService.class, () -> readiness);
            context.registerBean(PersonalizedRunningPlanner.class, PersonalizedRunningPlanner::new);
            context.registerBean(RaceEventRepository.class, () -> mock(RaceEventRepository.class));
            context.registerBean(InjuryRiskService.class, () -> mock(InjuryRiskService.class));
            context.registerBean(AutomatedCoachService.class);
            context.refresh();
            service = context.getBean(AutomatedCoachService.class);
        }

        @Override
        public void close() {
            context.close();
        }
    }
}
