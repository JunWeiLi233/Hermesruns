package com.hermes.backend.coaching;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PersonalizedRunningPlannerTests {

    private final PersonalizedRunningPlanner planner = new PersonalizedRunningPlanner();

    @Test
    void onboardingPlanIsConservativeWhenThereIsNoHistory() {
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                LocalDate.of(2026, 8, 24),
                history(0, 0, 0, 0, 0, 0, 0, 0, null, null, Map.of()),
                null,
                null,
                false,
                "LOW",
                null
        ));

        assertThat(plan.phase()).isEqualTo("onboarding");
        assertThat(plan.sessionsPerWeek()).isEqualTo(3);
        assertThat(plan.targetWeeklyKm()).isBetween(9.0, 15.0);
        assertThat(plan.sessions())
                .filteredOn(session -> session.workoutType() != CoachWorkoutType.REST)
                .allSatisfy(session -> {
                    assertThat(session.workoutType()).isIn(CoachWorkoutType.EASY, CoachWorkoutType.RECOVERY);
                    assertThat(session.distanceKm()).isLessThanOrEqualTo(5.0);
                });
    }

    @Test
    void highRiskAndRestReadinessProtectToday() {
        LocalDate today = LocalDate.of(2026, 8, 26);
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                today,
                history(40, 16, 28, 112, 7, 16, 330, 0.12, 72, 1, Map.of(DayOfWeek.WEDNESDAY, 8)),
                42,
                "REST",
                true,
                "HIGH",
                null
        ));

        assertThat(plan.phase()).isEqualTo("protect");
        assertThat(plan.today().workoutType()).isIn(CoachWorkoutType.REST, CoachWorkoutType.RECOVERY);
        assertThat(plan.today().readinessAdjusted()).isTrue();
        assertThat(plan.today().reasonCode()).isEqualTo("injury_protect");
        assertThat(plan.sessions().stream().limit(7))
                .noneMatch(session -> isHard(session.workoutType()));
    }

    @Test
    void comebackPlanDoesNotScheduleQualityWork() {
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                LocalDate.of(2026, 8, 24),
                history(24, 1, 0, 36, 8, 12, 345, 0.05, 500, 21, Map.of(DayOfWeek.TUESDAY, 4)),
                78,
                "EASY",
                true,
                "LOW",
                null
        ));

        assertThat(plan.phase()).isEqualTo("comeback");
        assertThat(plan.sessionsPerWeek()).isEqualTo(3);
        assertThat(plan.sessions()).noneMatch(session -> isHard(session.workoutType()));
        assertThat(plan.reasonCodes()).contains("comeback");
    }

    @Test
    void weeklyGrowthCapNeverPullsTargetBelowThePhaseFloor() {
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                LocalDate.of(2026, 8, 24),
                history(24, 1, 0, 4.0, 4.0, 4.0, 345, 0.05, 500, 21, Map.of(DayOfWeek.TUESDAY, 1)),
                78,
                "EASY",
                true,
                "LOW",
                null
        ));

        assertThat(plan.phase()).isEqualTo("comeback");
        assertThat(plan.targetWeeklyKm()).isGreaterThanOrEqualTo(9.0);
    }

    @Test
    void upcomingRaceCreatesTaperAndRaceDayPrescription() {
        LocalDate today = LocalDate.of(2026, 8, 24);
        PersonalizedRunningPlanner.Goal goal = new PersonalizedRunningPlanner.Goal(
                10.0,
                today.plusDays(7),
                2_700,
                "Autumn 10K"
        );
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                today,
                history(60, 20, 32, 128, 7.5, 18, 300, 0.16, 60, 1,
                        Map.of(DayOfWeek.TUESDAY, 7, DayOfWeek.THURSDAY, 7, DayOfWeek.SUNDAY, 8)),
                88,
                "GO",
                true,
                "LOW",
                goal
        ));

        assertThat(plan.phase()).isEqualTo("taper");
        assertThat(plan.reasonCodes()).contains("race_taper");
        assertThat(plan.sessions())
                .filteredOn(session -> session.date().equals(goal.targetRaceDate()))
                .singleElement()
                .satisfies(session -> {
                    assertThat(session.intent()).isEqualTo("race");
                    assertThat(session.reasonCode()).isEqualTo("race_day");
                    assertThat(session.distanceKm()).isEqualTo(10.0);
                });
    }

    @Test
    void buildPlanUsesObservedFrequencyAndCapsVolumeGrowth() {
        LocalDate today = LocalDate.of(2026, 8, 24);
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                today,
                history(80, 16, 22, 100, 6.5, 15, 315, 0.14, 80, 1,
                        Map.of(
                                DayOfWeek.TUESDAY, 9,
                                DayOfWeek.THURSDAY, 8,
                                DayOfWeek.SATURDAY, 7,
                                DayOfWeek.SUNDAY, 10
                        )),
                90,
                "GO",
                true,
                "LOW",
                null
        ));

        assertThat(plan.phase()).isEqualTo("build");
        assertThat(plan.sessionsPerWeek()).isEqualTo(4);
        assertThat(plan.targetWeeklyKm()).isLessThanOrEqualTo(27.5);
        assertThat(plan.preferredRunDays()).contains(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.SUNDAY);
        assertThat(plan.sessions().stream().limit(7).filter(session -> session.workoutType() != CoachWorkoutType.REST).count())
                .isEqualTo(4);
    }

    @Test
    void preservesAWeekendLongRunSlotWhenObservedHistoryFavorsWeekdays() {
        LocalDate today = LocalDate.of(2026, 8, 27);
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                today,
                history(12, 12, 24, 96, 8, 16, 330, 0.10, 72, 1,
                        Map.of(DayOfWeek.FRIDAY, 5, DayOfWeek.WEDNESDAY, 2, DayOfWeek.THURSDAY, 1)),
                90,
                "GO",
                true,
                "LOW",
                null
        ));

        assertThat(plan.preferredRunDays()).contains(DayOfWeek.SUNDAY);
        assertThat(plan.sessions())
                .filteredOn(session -> session.date().equals(today.plusDays(1)))
                .singleElement()
                .satisfies(session -> assertThat(session.workoutType()).isIn(CoachWorkoutType.TEMPO, CoachWorkoutType.THRESHOLD));
        assertThat(plan.sessions())
                .filteredOn(session -> session.date().equals(today.plusDays(3)))
                .singleElement()
                .extracting(PersonalizedRunningPlanner.PlannedSession::workoutType)
                .isEqualTo(CoachWorkoutType.LONG_RUN);
    }

    @Test
    void recentHardSessionDowngradesAnotherHardDay() {
        LocalDate today = LocalDate.of(2026, 8, 26);
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                today,
                history(80, 20, 20, 96, 6, 14, 305, 0.12, 20, 1,
                        Map.of(
                                DayOfWeek.WEDNESDAY, 12,
                                DayOfWeek.FRIDAY, 8,
                                DayOfWeek.SUNDAY, 10
                        )),
                91,
                "GO",
                true,
                "LOW",
                null
        ));

        assertThat(plan.phase()).isEqualTo("build");
        assertThat(plan.today().workoutType()).isIn(CoachWorkoutType.EASY, CoachWorkoutType.RECOVERY);
        assertThat(plan.today().reasonCode()).isEqualTo("recovery_after_hard");
        assertThat(plan.today().mutatedFrom()).isIn(CoachWorkoutType.TEMPO, CoachWorkoutType.THRESHOLD, CoachWorkoutType.INTERVALS);
    }

    @Test
    void paceTargetsAreDerivedFromTheRunnerBaseline() {
        PersonalizedRunningPlanner.PersonalizedPlan plan = planner.plan(input(
                LocalDate.of(2026, 8, 24),
                history(60, 16, 24, 96, 6, 14, 300, 0.10, 72, 1,
                        Map.of(DayOfWeek.TUESDAY, 8, DayOfWeek.THURSDAY, 8, DayOfWeek.SUNDAY, 8)),
                90,
                "GO",
                true,
                "LOW",
                null
        ));

        PersonalizedRunningPlanner.PlannedSession easy = plan.sessions().stream()
                .filter(session -> session.workoutType() == CoachWorkoutType.EASY)
                .findFirst()
                .orElseThrow();

        assertThat(easy.targetPaceMinSecondsPerKm()).isGreaterThanOrEqualTo(320);
        assertThat(easy.targetPaceMaxSecondsPerKm()).isGreaterThan(easy.targetPaceMinSecondsPerKm());
    }

    @Test
    void identicalInputsProduceIdenticalPlans() {
        PersonalizedRunningPlanner.PlannerInput input = input(
                LocalDate.of(2026, 8, 24),
                history(40, 12, 18, 80, 6, 13, 325, 0.18, 60, 2,
                        Map.of(DayOfWeek.TUESDAY, 6, DayOfWeek.THURSDAY, 6, DayOfWeek.SUNDAY, 7)),
                82,
                "EASY",
                true,
                "LOW",
                null
        );

        assertThat(planner.plan(input)).isEqualTo(planner.plan(input));
    }

    private PersonalizedRunningPlanner.PlannerInput input(
            LocalDate today,
            PersonalizedRunningPlanner.RunHistory history,
            Integer readinessScore,
            String readinessVerdict,
            boolean readinessSupported,
            String injuryRisk,
            PersonalizedRunningPlanner.Goal goal
    ) {
        return new PersonalizedRunningPlanner.PlannerInput(
                today,
                14,
                history,
                readinessScore,
                readinessVerdict,
                readinessSupported,
                injuryRisk,
                null,
                goal
        );
    }

    private PersonalizedRunningPlanner.RunHistory history(
            int totalRuns,
            int runDays28,
            double volume7Km,
            double volume28Km,
            double averageRunKm,
            double longestRunKm28,
            double averagePaceSecondsPerKm,
            double highIntensityRatio7d,
            Integer hoursSinceHardRun,
            Integer daysSinceLastRun,
            Map<DayOfWeek, Integer> preferredDayCounts
    ) {
        return new PersonalizedRunningPlanner.RunHistory(
                totalRuns,
                runDays28,
                volume7Km,
                volume28Km,
                averageRunKm,
                longestRunKm28,
                averagePaceSecondsPerKm,
                highIntensityRatio7d,
                hoursSinceHardRun,
                daysSinceLastRun,
                preferredDayCounts
        );
    }

    private boolean isHard(CoachWorkoutType type) {
        return type == CoachWorkoutType.TEMPO
                || type == CoachWorkoutType.THRESHOLD
                || type == CoachWorkoutType.INTERVALS;
    }
}
