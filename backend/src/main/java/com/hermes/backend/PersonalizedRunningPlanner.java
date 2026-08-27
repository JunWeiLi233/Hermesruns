package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Pure, deterministic running-plan engine. Repository and localization concerns stay outside this
 * class so the same normalized inputs always produce the same plan.
 */
@Service
public class PersonalizedRunningPlanner {

    private static final int DEFAULT_HORIZON_DAYS = 14;
    private static final int MIN_HORIZON_DAYS = 1;
    private static final int MAX_HORIZON_DAYS = 28;
    private static final double MAX_WEEKLY_GROWTH = 1.10;
    private static final double HIGH_ACWR = 1.30;
    private static final double HIGH_INTENSITY_SHARE = 0.20;
    private static final int HARD_SESSION_RECOVERY_HOURS = 36;
    private static final List<DayOfWeek> DEFAULT_RUN_DAYS = List.of(
            DayOfWeek.TUESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.SUNDAY,
            DayOfWeek.SATURDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.FRIDAY
    );

    public PersonalizedPlan plan(PlannerInput rawInput) {
        PlannerInput input = normalize(rawInput);
        RunHistory history = input.history();
        double acwr = computeAcwr(history);
        String phase = resolvePhase(input, acwr);
        int sessionsPerWeek = resolveSessionsPerWeek(history, phase);
        List<DayOfWeek> preferredRunDays = resolvePreferredRunDays(history, sessionsPerWeek);
        double targetWeeklyKm = resolveTargetWeeklyKm(history, phase, sessionsPerWeek);
        List<String> reasonCodes = planReasonCodes(input, phase, acwr);
        List<PlannedSession> sessions = buildSessions(
                input,
                phase,
                targetWeeklyKm,
                preferredRunDays
        );
        PlannedSession today = sessions.stream()
                .filter(session -> input.today().equals(session.date()))
                .findFirst()
                .orElseThrow();

        return new PersonalizedPlan(
                phase,
                round1(targetWeeklyKm),
                sessionsPerWeek,
                List.copyOf(preferredRunDays),
                confidence(history, input),
                List.copyOf(reasonCodes),
                List.copyOf(sessions),
                today
        );
    }

    private PlannerInput normalize(PlannerInput rawInput) {
        LocalDate today = rawInput == null || rawInput.today() == null ? LocalDate.now() : rawInput.today();
        int horizon = rawInput == null ? DEFAULT_HORIZON_DAYS : rawInput.horizonDays();
        horizon = clamp(horizon <= 0 ? DEFAULT_HORIZON_DAYS : horizon, MIN_HORIZON_DAYS, MAX_HORIZON_DAYS);
        RunHistory history = rawInput == null || rawInput.history() == null ? RunHistory.empty() : rawInput.history().normalized();
        return new PlannerInput(
                today,
                horizon,
                history,
                rawInput == null ? null : rawInput.readinessScore(),
                normalizeCode(rawInput == null ? null : rawInput.readinessVerdict()),
                rawInput != null && rawInput.readinessSupported(),
                normalizeCode(rawInput == null ? null : rawInput.injuryRisk()),
                normalizeCode(rawInput == null ? null : rawInput.sorenessLevel()),
                rawInput == null ? null : rawInput.goal()
        );
    }

    private String resolvePhase(PlannerInput input, double acwr) {
        Goal goal = input.goal();
        if (goal != null && goal.targetRaceDate() != null && goal.targetRaceDate().equals(input.today())) {
            return "race";
        }
        if ("HIGH".equals(input.injuryRisk()) || "HIGH".equals(input.sorenessLevel()) || "REST".equals(input.readinessVerdict())) {
            return "protect";
        }
        Integer daysSinceLastRun = input.history().daysSinceLastRun();
        if (daysSinceLastRun != null && daysSinceLastRun >= 14) {
            return "comeback";
        }
        if (input.history().totalRuns() < 3) {
            return "onboarding";
        }
        if (goal != null && goal.targetRaceDate() != null) {
            long daysToRace = ChronoUnit.DAYS.between(input.today(), goal.targetRaceDate());
            if (daysToRace >= 0 && daysToRace <= 14) {
                return "taper";
            }
        }
        if (acwr > HIGH_ACWR) {
            return "absorb";
        }
        if (input.history().highIntensityRatio7d() > HIGH_INTENSITY_SHARE) {
            return "rebalance";
        }
        return "build";
    }

    private int resolveSessionsPerWeek(RunHistory history, String phase) {
        int inferred = history.runDays28() > 0
                ? (int) Math.round(history.runDays28() / 4.0)
                : 3;
        inferred = clamp(inferred, 3, 6);
        if ("protect".equals(phase)) return Math.min(3, inferred);
        if ("onboarding".equals(phase) || "comeback".equals(phase)) return 3;
        return inferred;
    }

    private List<DayOfWeek> resolvePreferredRunDays(RunHistory history, int sessionsPerWeek) {
        Map<DayOfWeek, Integer> counts = new EnumMap<>(DayOfWeek.class);
        counts.putAll(history.preferredDayCounts());
        List<DayOfWeek> rankedHistory = counts.entrySet().stream()
                .sorted(Map.Entry.<DayOfWeek, Integer>comparingByValue(Comparator.reverseOrder())
                        .thenComparingInt(entry -> defaultDayRank(entry.getKey())))
                .map(Map.Entry::getKey)
                .toList();

        Set<DayOfWeek> selected = new LinkedHashSet<>();
        rankedHistory.forEach(day -> {
            if (selected.size() < sessionsPerWeek) selected.add(day);
        });
        DEFAULT_RUN_DAYS.forEach(day -> {
            if (selected.size() < sessionsPerWeek) selected.add(day);
        });
        if (sessionsPerWeek >= 3 && selected.stream().noneMatch(this::isWeekend)) {
            DayOfWeek lastSelected = null;
            for (DayOfWeek day : selected) {
                lastSelected = day;
            }
            if (lastSelected != null) {
                selected.remove(lastSelected);
                selected.add(DayOfWeek.SUNDAY);
            }
        }
        return selected.stream()
                .sorted(Comparator.comparingInt(DayOfWeek::getValue))
                .toList();
    }

    private boolean isWeekend(DayOfWeek day) {
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }

    private int defaultDayRank(DayOfWeek day) {
        int index = DEFAULT_RUN_DAYS.indexOf(day);
        return index < 0 ? DEFAULT_RUN_DAYS.size() + day.getValue() : index;
    }

    private double resolveTargetWeeklyKm(RunHistory history, String phase, int sessionsPerWeek) {
        double chronicWeekly = history.volume28Km() > 0
                ? history.volume28Km() / 4.0
                : history.averageRunKm() > 0
                    ? history.averageRunKm() * sessionsPerWeek
                    : 12.0;
        double multiplier = switch (phase) {
            case "protect" -> 0.55;
            case "comeback" -> 0.65;
            case "taper" -> 0.70;
            case "absorb" -> 0.80;
            case "rebalance" -> 0.90;
            case "race" -> 0.75;
            case "onboarding" -> 1.0;
            default -> 1.05;
        };
        double floor = switch (phase) {
            case "protect" -> 6.0;
            case "comeback", "onboarding" -> 9.0;
            default -> Math.min(18.0, sessionsPerWeek * 3.0);
        };
        double target = Math.max(floor, chronicWeekly * multiplier);
        if (history.volume28Km() > 0) {
            target = Math.min(target, Math.max(floor, chronicWeekly * MAX_WEEKLY_GROWTH));
        }
        return round1(target);
    }

    private List<String> planReasonCodes(PlannerInput input, String phase, double acwr) {
        List<String> reasons = new ArrayList<>();
        reasons.add(switch (phase) {
            case "protect" -> "HIGH".equals(input.injuryRisk()) || "HIGH".equals(input.sorenessLevel())
                    ? "injury_protect"
                    : "readiness_protect";
            case "comeback" -> "comeback";
            case "onboarding" -> "onboarding";
            case "taper" -> "race_taper";
            case "race" -> "race_day";
            case "absorb" -> "high_load";
            case "rebalance" -> "intensity_rebalance";
            default -> "build_consistency";
        });
        if (input.readinessSupported() && input.readinessScore() != null) reasons.add("readiness_data");
        if (acwr > 0) reasons.add("load_data");
        if (input.goal() != null && input.goal().targetRaceDate() != null) reasons.add("goal_specific");
        return reasons;
    }

    private List<PlannedSession> buildSessions(
            PlannerInput input,
            String phase,
            double targetWeeklyKm,
            List<DayOfWeek> preferredRunDays
    ) {
        List<PlannedSession> sessions = new ArrayList<>();
        DayOfWeek longRunDay = resolveLongRunDay(preferredRunDays, input.history());
        DayOfWeek qualityDay = resolveQualityDay(preferredRunDays, longRunDay, input.history());

        for (int index = 0; index < input.horizonDays(); index++) {
            LocalDate date = input.today().plusDays(index);
            SessionDraft draft = baseSession(date, phase, preferredRunDays, longRunDay, qualityDay, input);
            draft = applyRaceOverride(draft, date, input.goal());
            draft = applyTodayProtection(draft, date, input, phase);
            Double distanceKm = distanceFor(draft, targetWeeklyKm, input.history(), input.goal(), preferredRunDays.size(), phase);
            PaceRange pace = paceFor(draft.workoutType(), input.history().averagePaceSecondsPerKm(), input.goal());
            Integer durationMinutes = durationFor(distanceKm, pace, draft.workoutType());
            sessions.add(new PlannedSession(
                    date,
                    draft.workoutType(),
                    distanceKm,
                    durationMinutes,
                    draft.stridesSuggested(),
                    phase,
                    draft.intent(),
                    draft.reasonCode(),
                    pace.minSecondsPerKm(),
                    pace.maxSecondsPerKm(),
                    draft.mutatedFrom(),
                    draft.readinessAdjusted()
            ));
        }
        return sessions;
    }

    private SessionDraft baseSession(
            LocalDate date,
            String phase,
            List<DayOfWeek> preferredRunDays,
            DayOfWeek longRunDay,
            DayOfWeek qualityDay,
            PlannerInput input
    ) {
        if (!preferredRunDays.contains(date.getDayOfWeek())) {
            return new SessionDraft(CoachWorkoutType.REST, "rest", phaseReason(phase, input), false, null, false);
        }

        if ("protect".equals(phase)) {
            return new SessionDraft(CoachWorkoutType.RECOVERY, "recovery", phaseReason(phase, input), false, null, false);
        }
        if ("onboarding".equals(phase)) {
            return new SessionDraft(CoachWorkoutType.EASY, "onboarding", "onboarding", false, null, false);
        }
        if ("comeback".equals(phase)) {
            return new SessionDraft(CoachWorkoutType.EASY, "comeback", "comeback", false, null, false);
        }
        if ("absorb".equals(phase)) {
            CoachWorkoutType type = date.getDayOfWeek() == longRunDay ? CoachWorkoutType.EASY : CoachWorkoutType.RECOVERY;
            return new SessionDraft(type, type == CoachWorkoutType.RECOVERY ? "recovery" : "easy", "high_load", false, null, false);
        }
        if ("rebalance".equals(phase)) {
            CoachWorkoutType type = date.getDayOfWeek() == longRunDay ? CoachWorkoutType.LONG_RUN : CoachWorkoutType.EASY;
            return new SessionDraft(type, type == CoachWorkoutType.LONG_RUN ? "long_run" : "easy", "intensity_rebalance", false, null, false);
        }
        if ("taper".equals(phase)) {
            if (date.getDayOfWeek() == qualityDay && daysUntilGoal(date, input.goal()) > 3) {
                return new SessionDraft(CoachWorkoutType.TEMPO, "quality", "race_taper", true, null, false);
            }
            return new SessionDraft(CoachWorkoutType.EASY, "easy", "race_taper", date.getDayOfWeek() == longRunDay, null, false);
        }

        if (date.getDayOfWeek() == longRunDay) {
            return new SessionDraft(CoachWorkoutType.LONG_RUN, "long_run", "aerobic_progression", false, null, false);
        }
        if (date.getDayOfWeek() == qualityDay) {
            CoachWorkoutType qualityType = input.goal() != null ? CoachWorkoutType.THRESHOLD : CoachWorkoutType.TEMPO;
            return new SessionDraft(qualityType, "quality", input.goal() != null ? "goal_specific" : "quality_window", true, null, false);
        }
        return new SessionDraft(CoachWorkoutType.EASY, "easy", "build_consistency", false, null, false);
    }

    private SessionDraft applyRaceOverride(SessionDraft draft, LocalDate date, Goal goal) {
        if (goal == null || goal.targetRaceDate() == null || !goal.targetRaceDate().equals(date)) return draft;
        return new SessionDraft(CoachWorkoutType.LONG_RUN, "race", "race_day", false, draft.workoutType(), false);
    }

    private SessionDraft applyTodayProtection(SessionDraft draft, LocalDate date, PlannerInput input, String phase) {
        if (!date.equals(input.today())) return draft;

        // A first-day onboarding plan should leave room to establish a baseline
        // before asking a new runner to train. Keep the onboarding reason code
        // so the UI explains the conservative choice without presenting it as
        // a readiness mutation.
        if ("onboarding".equals(phase)) {
            return new SessionDraft(CoachWorkoutType.REST, "rest", "onboarding", false, null, false);
        }

        if ("protect".equals(phase)) {
            CoachWorkoutType protectedType = "REST".equals(input.readinessVerdict()) && !"HIGH".equals(input.injuryRisk())
                    ? CoachWorkoutType.REST
                    : CoachWorkoutType.RECOVERY;
            String reason = "HIGH".equals(input.injuryRisk()) || "HIGH".equals(input.sorenessLevel())
                    ? "injury_protect"
                    : "readiness_protect";
            return new SessionDraft(protectedType, protectedType == CoachWorkoutType.REST ? "rest" : "recovery", reason,
                    false, draft.workoutType(), true);
        }

        if (isHard(draft.workoutType())
                && input.history().hoursSinceHardRun() != null
                && input.history().hoursSinceHardRun() < HARD_SESSION_RECOVERY_HOURS) {
            return new SessionDraft(CoachWorkoutType.EASY, "easy", "recovery_after_hard", false, draft.workoutType(), true);
        }

        if (("RECOVERY".equals(input.readinessVerdict()) || "EASY".equals(input.readinessVerdict()))
                && isHard(draft.workoutType())) {
            return new SessionDraft(CoachWorkoutType.EASY, "easy", "readiness_protect", false, draft.workoutType(), true);
        }
        return draft;
    }

    private String phaseReason(String phase, PlannerInput input) {
        if ("protect".equals(phase)) {
            return "HIGH".equals(input.injuryRisk()) || "HIGH".equals(input.sorenessLevel())
                    ? "injury_protect"
                    : "readiness_protect";
        }
        return phase;
    }

    private DayOfWeek resolveLongRunDay(List<DayOfWeek> preferredRunDays, RunHistory history) {
        return preferredRunDays.stream()
                .filter(day -> day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY)
                .max(Comparator
                        .comparingInt((DayOfWeek day) -> history.preferredDayCounts().getOrDefault(day, 0))
                        .thenComparingInt(day -> day == DayOfWeek.SUNDAY ? 1 : 0))
                .orElse(preferredRunDays.get(preferredRunDays.size() - 1));
    }

    private DayOfWeek resolveQualityDay(List<DayOfWeek> preferredRunDays, DayOfWeek longRunDay, RunHistory history) {
        return preferredRunDays.stream()
                .filter(day -> day != longRunDay)
                .filter(day -> day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY)
                .max(Comparator
                        .comparingInt((DayOfWeek day) -> history.preferredDayCounts().getOrDefault(day, 0))
                        .thenComparingInt(day -> -defaultDayRank(day)))
                .orElse(preferredRunDays.get(0));
    }

    private Double distanceFor(
            SessionDraft draft,
            double targetWeeklyKm,
            RunHistory history,
            Goal goal,
            int sessionsPerWeek,
            String phase
    ) {
        CoachWorkoutType type = draft.workoutType();
        if (type == CoachWorkoutType.REST || type == CoachWorkoutType.CROSS_TRAIN) return null;
        if ("race".equals(draft.intent()) && goal != null && goal.raceDistanceKm() != null) {
            return round1(goal.raceDistanceKm());
        }

        double average = history.averageRunKm() > 0
                ? history.averageRunKm()
                : targetWeeklyKm / Math.max(1, sessionsPerWeek);
        double distance = switch (type) {
            case RECOVERY -> clamp(average * 0.65, 3.0, 10.0);
            case EASY -> clamp(average * 0.90, 4.0, 16.0);
            case TEMPO, THRESHOLD, INTERVALS -> clamp(average * 1.05, 5.0, 18.0);
            case LONG_RUN -> clamp(Math.max(average * 1.60, history.longestRunKm28() * 0.95), 8.0, 32.0);
            default -> clamp(average, 3.0, 16.0);
        };

        if ("onboarding".equals(phase)) distance = Math.min(distance, 5.0);
        if ("comeback".equals(phase)) distance = Math.min(distance, 6.0);
        if ("protect".equals(phase)) distance = Math.min(distance, 5.0);
        if ("taper".equals(phase)) distance *= 0.75;
        if (type == CoachWorkoutType.LONG_RUN && goal != null && goal.raceDistanceKm() != null) {
            distance = Math.min(distance, Math.max(8.0, goal.raceDistanceKm() * 0.75));
        }
        return round1(distance);
    }

    private PaceRange paceFor(CoachWorkoutType type, double averagePaceSecondsPerKm, Goal goal) {
        if (averagePaceSecondsPerKm <= 0 || type == CoachWorkoutType.REST || type == CoachWorkoutType.CROSS_TRAIN) {
            return PaceRange.empty();
        }
        int baseline = (int) Math.round(averagePaceSecondsPerKm);
        int fast;
        int slow;
        switch (type) {
            case RECOVERY -> {
                fast = baseline + 50;
                slow = baseline + 95;
            }
            case EASY -> {
                fast = baseline + 20;
                slow = baseline + 60;
            }
            case LONG_RUN -> {
                fast = baseline + 15;
                slow = baseline + 50;
            }
            case TEMPO -> {
                fast = baseline - 20;
                slow = baseline + 5;
            }
            case THRESHOLD -> {
                fast = baseline - 35;
                slow = baseline - 10;
            }
            case INTERVALS -> {
                fast = baseline - 60;
                slow = baseline - 25;
            }
            default -> {
                fast = baseline;
                slow = baseline + 30;
            }
        }
        Integer goalPace = goalPace(goal);
        if (goalPace != null && (type == CoachWorkoutType.TEMPO || type == CoachWorkoutType.THRESHOLD)) {
            fast = Math.min(fast, goalPace);
            slow = Math.min(slow, goalPace + 20);
        }
        fast = Math.max(120, fast);
        slow = Math.max(fast + 5, slow);
        return new PaceRange(fast, slow);
    }

    private Integer goalPace(Goal goal) {
        if (goal == null || goal.raceDistanceKm() == null || goal.raceDistanceKm() <= 0
                || goal.goalTimeSeconds() == null || goal.goalTimeSeconds() <= 0) return null;
        return (int) Math.round(goal.goalTimeSeconds() / goal.raceDistanceKm());
    }

    private Integer durationFor(Double distanceKm, PaceRange pace, CoachWorkoutType type) {
        if (distanceKm == null || distanceKm <= 0 || type == CoachWorkoutType.REST) return null;
        int paceSeconds = pace.minSecondsPerKm() != null && pace.maxSecondsPerKm() != null
                ? (pace.minSecondsPerKm() + pace.maxSecondsPerKm()) / 2
                : 360;
        return Math.max(20, (int) Math.round(distanceKm * paceSeconds / 60.0));
    }

    private double computeAcwr(RunHistory history) {
        double chronicWeekly = history.volume28Km() / 4.0;
        if (chronicWeekly <= 0.1) return 0;
        return history.volume7Km() / chronicWeekly;
    }

    private int confidence(RunHistory history, PlannerInput input) {
        int score = 30;
        score += Math.min(35, history.totalRuns() * 2);
        if (history.averagePaceSecondsPerKm() > 0) score += 10;
        if (input.readinessSupported()) score += 15;
        if (input.goal() != null && input.goal().targetRaceDate() != null) score += 10;
        return clamp(score, 30, 95);
    }

    private long daysUntilGoal(LocalDate date, Goal goal) {
        if (goal == null || goal.targetRaceDate() == null) return Long.MAX_VALUE;
        return ChronoUnit.DAYS.between(date, goal.targetRaceDate());
    }

    private boolean isHard(CoachWorkoutType type) {
        return type == CoachWorkoutType.TEMPO
                || type == CoachWorkoutType.THRESHOLD
                || type == CoachWorkoutType.INTERVALS;
    }

    private String normalizeCode(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    public record PlannerInput(
            LocalDate today,
            int horizonDays,
            RunHistory history,
            Integer readinessScore,
            String readinessVerdict,
            boolean readinessSupported,
            String injuryRisk,
            String sorenessLevel,
            Goal goal
    ) {}

    public record RunHistory(
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
        public static RunHistory empty() {
            return new RunHistory(0, 0, 0, 0, 0, 0, 0, 0, null, null, Map.of());
        }

        private RunHistory normalized() {
            Map<DayOfWeek, Integer> safeCounts = new EnumMap<>(DayOfWeek.class);
            if (preferredDayCounts != null) {
                preferredDayCounts.forEach((day, count) -> {
                    if (day != null && count != null && count > 0) safeCounts.put(day, count);
                });
            }
            return new RunHistory(
                    Math.max(0, totalRuns),
                    Math.max(0, runDays28),
                    Math.max(0, volume7Km),
                    Math.max(0, volume28Km),
                    Math.max(0, averageRunKm),
                    Math.max(0, longestRunKm28),
                    Math.max(0, averagePaceSecondsPerKm),
                    Math.max(0, highIntensityRatio7d),
                    hoursSinceHardRun == null ? null : Math.max(0, hoursSinceHardRun),
                    daysSinceLastRun == null ? null : Math.max(0, daysSinceLastRun),
                    Map.copyOf(safeCounts)
            );
        }
    }

    public record Goal(
            Double raceDistanceKm,
            LocalDate targetRaceDate,
            Integer goalTimeSeconds,
            String name
    ) {}

    public record PlannedSession(
            LocalDate date,
            CoachWorkoutType workoutType,
            Double distanceKm,
            Integer durationMinutes,
            boolean stridesSuggested,
            String phase,
            String intent,
            String reasonCode,
            Integer targetPaceMinSecondsPerKm,
            Integer targetPaceMaxSecondsPerKm,
            CoachWorkoutType mutatedFrom,
            boolean readinessAdjusted
    ) {}

    public record PersonalizedPlan(
            String phase,
            double targetWeeklyKm,
            int sessionsPerWeek,
            List<DayOfWeek> preferredRunDays,
            int confidence,
            List<String> reasonCodes,
            List<PlannedSession> sessions,
            PlannedSession today
    ) {}

    private record SessionDraft(
            CoachWorkoutType workoutType,
            String intent,
            String reasonCode,
            boolean stridesSuggested,
            CoachWorkoutType mutatedFrom,
            boolean readinessAdjusted
    ) {}

    private record PaceRange(Integer minSecondsPerKm, Integer maxSecondsPerKm) {
        private static PaceRange empty() {
            return new PaceRange(null, null);
        }
    }
}
