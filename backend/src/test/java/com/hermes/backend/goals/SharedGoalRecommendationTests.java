package com.hermes.backend.goals;

import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.coaching.TrainingLogRepository;
import com.hermes.backend.runner.Runner;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SharedGoalRecommendationTests {
    private final LocalDate today = LocalDate.of(2026, 10, 16);
    private final GoalRepository goals = mock(GoalRepository.class);
    private final TrainingLogRepository runs = mock(TrainingLogRepository.class);
    private final AutomatedCoachService coach = mock(AutomatedCoachService.class);
    private final Runner runner = new Runner();
    private final GoalService service = new GoalService(goals, runs, Clock.fixed(today.atTime(12,0).toInstant(ZoneOffset.UTC), ZoneOffset.UTC));

    SharedGoalRecommendationTests() {
        runner.setId(7L);
        runner.setTimeZone("UTC");
        ReflectionTestUtils.setField(service, "coach", coach);
        when(goals.findByRunnerIdOrderByIdAsc(7L)).thenReturn(List.of());
        List<TrainingLogRepository.LogRunRow> history = new ArrayList<>();
        LocalDate monday = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for (int week=1; week<=8; week++) for (int day : new int[]{1,4}) {
            var run = mock(TrainingLogRepository.LogRunRow.class);
            when(run.getLocalDate()).thenReturn(monday.minusWeeks(week).plusDays(day));
            when(run.getDistanceKm()).thenReturn(18d);
            history.add(run);
        }
        when(runs.findRows(eq(7L), any(), any(), any())).thenReturn(history);
    }

    private void prescribe(double km, int sessions) {
        var plan = new AutomatedCoachService.CoachPlanDto("protect", km, sessions, List.of("TUESDAY", "SATURDAY"), 80, List.of("injury_protect"));
        when(coach.getTodayWithReadiness(runner)).thenReturn(new AutomatedCoachService.CoachTodayDto(null, null, null, null, "", "", plan));
    }

    @Test void recoveryGoalUsesTheSameNineKmAsTheCoachInsteadOfAddingTenPercentToThirtySix() {
        prescribe(9,2);
        var suggestions = service.suggest(runner).suggestions();
        assertThat(suggestions).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"))
                .singleElement().satisfies(s -> { assertThat(s.target()).isEqualTo(9); assertThat(s.basis().kind()).isEqualTo("coach-plan"); });
        assertThat(suggestions).filteredOn(s -> s.metric().equals("COUNT")).singleElement().satisfies(s -> assertThat(s.target()).isEqualTo(2));
        assertThat(suggestions).filteredOn(s -> s.period().equals("WEEK"))
                .allSatisfy(s -> assertThat(s.basis().kind()).isEqualTo("coach-plan"));
        assertThat(suggestions).anyMatch(s -> s.period().equals("MONTH") && s.basis().kind().equals("monthly-average"));
        verify(coach).getTodayWithReadiness(runner);
    }
    @Test void aRecentRunCanSupportAPrescribedGoalBeforeThereAreFourCompleteWeeks() {
        prescribe(9, 2);
        var recent = mock(TrainingLogRepository.LogRunRow.class);
        when(recent.getLocalDate()).thenReturn(today.minusDays(1));
        when(recent.getDistanceKm()).thenReturn(5d);
        when(runs.findRows(eq(7L), any(), any(), any())).thenReturn(List.of(recent));

        var response = service.suggest(runner);
        assertThat(response.enough()).isTrue();
        assertThat(response.suggestions()).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"))
                .singleElement().satisfies(s -> assertThat(s.target()).isEqualTo(9));
    }

    @Test void unavailableCoachRetainsHistoricalTrackingSuggestions() {
        var response = service.suggest(runner);
        assertThat(response.enough()).isTrue();
        assertThat(response.suggestions()).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"))
                .singleElement().satisfies(s -> {
                    assertThat(s.target()).isEqualTo(40);
                    assertThat(s.basis().kind()).isEqualTo("weekly-average");
                });
        assertThat(response.suggestions()).anyMatch(s -> s.period().equals("MONTH"));
    }
    @Test void publishedTargetsUseThePublishedCalendarWhileTrackingGoalsKeepTheAccountCalendar() {
        var plan = new AutomatedCoachService.CoachPlanDto("ADAPT", 10.5, 2, List.of("TUESDAY", "SATURDAY"),
                100, List.of("VERSIONED_PLAN"), "Pacific/Kiritimati");
        when(coach.getTodayWithReadiness(runner)).thenReturn(
                new AutomatedCoachService.CoachTodayDto(null, null, null, null, "", "", plan));
        var response = service.suggest(runner);
        assertThat(response.today()).isEqualTo(today.plusDays(1));
        assertThat(response.timeZone()).isEqualTo("Pacific/Kiritimati");
        assertThat(response.suggestions()).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"))
                .singleElement().satisfies(s -> assertThat(s.target()).isEqualTo(10.5));
        assertThat(service.list(runner, null).today()).isEqualTo(today);
    }
    @Test void noHistoryDoesNotOfferTheCoachOnboardingDefaultsAsPersonalizedGoals() {
        prescribe(12,3);
        when(runs.findRows(eq(7L), any(), any(), any())).thenReturn(List.of());
        assertThat(service.suggest(runner).suggestions()).isEmpty();
    }
    @Test void invalidTargetsAreNotOfferedAndExistingGoalsArePreserved() {
        prescribe(Double.POSITIVE_INFINITY,0);
        assertThat(service.suggest(runner).suggestions()).isNotEmpty()
                .allSatisfy(s -> assertThat(s.target()).isFinite().isPositive())
                .noneMatch(s -> s.basis().kind().equals("coach-plan"));
        prescribe(9,2);
        when(goals.findByRunnerIdOrderByIdAsc(7L)).thenReturn(List.of(new Goal(runner,"WEEK","DISTANCE",40)));
        assertThat(service.suggest(runner).suggestions()).noneMatch(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"));
    }

    @Test void anExhaustedWeekDoesNotOfferAnAlreadyCompletedDistanceGoalAndCarriesTheSameEvidence() {
        var budget = new com.hermes.backend.coaching.WeeklyMileageBudget.Week(today.minusDays(4), today.plusDays(2),
                24.9, 35.345, 0, 0, 35.345);
        var plan = new AutomatedCoachService.CoachPlanDto("absorb", 24.9, 4, List.of("TUESDAY", "SATURDAY"),
                80, List.of("high_load"), "UTC", null, List.of(budget), null);
        var prescription = new AutomatedCoachService.CoachTodayDto(null, null, null, null, "", "", plan);
        when(coach.getTodayWithReadiness(runner)).thenReturn(prescription);
        var response = service.suggest(runner);
        assertThat(response.suggestions()).noneMatch(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE"));
        assertThat(response.recommendation()).isSameAs(prescription);
        verify(goals, never()).save(any());
    }
}
