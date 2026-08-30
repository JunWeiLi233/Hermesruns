package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class PersonalizedStrengthPlanEngine {

    static final String ALGORITHM_VERSION = "runner-strength-v1";

    public PersonalizedStrengthPlan plan(RunnerStrengthSignals input) {
        RunnerStrengthSignals.PlanPhase phase = phaseFor(input.cycleStartDate(), input.today());
        List<String> missingSignals = List.copyOf(input.missingSignals());
        List<RunnerStrengthSignals.RunDaySignal> schedule = scheduleFor(input);

        if (noSessionState(input)) {
            return suppressedPlan(input, phase, missingSignals, schedule);
        }

        RunnerStrengthSignals.StrengthFocus appliedFocus = appliedFocus(input, phase);
        DoseDecision doseDecision = safeDose(input, phase, schedule);
        RunnerStrengthSignals.StrengthDose appliedDose = doseDecision.dose();
        int weeklyTarget = weeklyTarget(input, phase);
        List<Candidate> candidates = schedule.stream()
                .map(day -> new Candidate(day, scoreDay(input, schedule, day, appliedDose)))
                .filter(candidate -> candidate.score() != Integer.MIN_VALUE)
                .sorted(Comparator.comparingInt(Candidate::score).reversed()
                        .thenComparing(candidate -> candidate.day().date()))
                .toList();

        List<LocalDate> selectedDates = new ArrayList<>();
        int[] selectedByWeek = new int[4];
        if (isManualRequest(input)) {
            Candidate todayCandidate = candidates.stream()
                    .filter(candidate -> candidate.day().date().equals(input.today()))
                    .findFirst()
                    .orElse(null);
            if (todayCandidate != null) {
                selectedDates.add(input.today());
                selectedByWeek[0]++;
            }
        }
        for (Candidate candidate : candidates) {
            int week = weekIndex(input.today(), candidate.day().date());
            if (selectedDates.contains(candidate.day().date())
                    || selectedByWeek[week] >= weeklyTarget
                    || !hasFullRecoveryDay(selectedDates, candidate.day().date())) {
                continue;
            }
            selectedDates.add(candidate.day().date());
            selectedByWeek[week]++;
        }

        List<String> sessionReasons = sessionReasons(input, doseDecision);
        List<PersonalizedStrengthPlan.PlannedDay> days = new ArrayList<>();
        for (RunnerStrengthSignals.RunDaySignal day : schedule) {
            if (selectedDates.contains(day.date())) {
                RunnerStrengthSignals.SafetyAction action = actionFor(input, day.date(), appliedDose);
                days.add(new PersonalizedStrengthPlan.PlannedDay(
                        day.date(),
                        new PersonalizedStrengthPlan.PlannedSession(
                                "CUSTOM_" + appliedFocus + "_" + appliedDose,
                                input.requestedFocus(),
                                input.requestedDose(),
                                appliedFocus,
                                appliedDose,
                                action,
                                List.copyOf(sessionReasons)
                        ),
                        null
                ));
            } else {
                days.add(new PersonalizedStrengthPlan.PlannedDay(
                        day.date(),
                        null,
                        noStrengthReason(input, schedule, day, appliedDose, selectedDates, selectedByWeek, weeklyTarget)
                ));
            }
        }

        return new PersonalizedStrengthPlan(
                ALGORITHM_VERSION,
                phase,
                phase.ordinal() + 1,
                confidenceFor(missingSignals),
                missingSignals,
                safetyAdjustment(input, selectedDates, appliedFocus, appliedDose, sessionReasons),
                List.copyOf(days)
        );
    }

    RunnerStrengthSignals.PlanPhase phaseFor(LocalDate anchor, LocalDate today) {
        long elapsedWeeks = Math.max(0, ChronoUnit.WEEKS.between(anchor, today));
        RunnerStrengthSignals.PlanPhase[] phases = RunnerStrengthSignals.PlanPhase.values();
        return phases[(int) (elapsedWeeks % phases.length)];
    }

    private PersonalizedStrengthPlan suppressedPlan(RunnerStrengthSignals input,
            RunnerStrengthSignals.PlanPhase phase,
            List<String> missingSignals,
            List<RunnerStrengthSignals.RunDaySignal> schedule) {
        List<PersonalizedStrengthPlan.PlannedDay> days = schedule.stream()
                .map(day -> new PersonalizedStrengthPlan.PlannedDay(day.date(), null, "SAFETY_NO_SESSION"))
                .toList();
        PersonalizedStrengthPlan.SafetyAdjustment adjustment = new PersonalizedStrengthPlan.SafetyAdjustment(
                input.requestedFocus(),
                input.requestedDose(),
                null,
                null,
                RunnerStrengthSignals.SafetyAction.SUPPRESSED,
                List.of("SAFETY_NO_SESSION")
        );
        return new PersonalizedStrengthPlan(
                ALGORITHM_VERSION,
                phase,
                phase.ordinal() + 1,
                confidenceFor(missingSignals),
                missingSignals,
                adjustment,
                List.copyOf(days)
        );
    }

    private List<RunnerStrengthSignals.RunDaySignal> scheduleFor(RunnerStrengthSignals input) {
        List<RunnerStrengthSignals.RunDaySignal> supplied = List.copyOf(input.schedule());
        List<RunnerStrengthSignals.RunDaySignal> days = new ArrayList<>();
        for (int offset = 0; offset < 28; offset++) {
            LocalDate date = input.today().plusDays(offset);
            RunnerStrengthSignals.RunDaySignal signal = supplied.stream()
                    .filter(candidate -> date.equals(candidate.date()))
                    .findFirst()
                    .orElse(new RunnerStrengthSignals.RunDaySignal(date, "REST", false, false, false));
            days.add(signal);
        }
        return List.copyOf(days);
    }

    private int weeklyTarget(RunnerStrengthSignals input, RunnerStrengthSignals.PlanPhase phase) {
        if (noSessionState(input)) {
            return 0;
        }
        if (input.raceWeek()
                || lowDataConservative(input)
                || phase == RunnerStrengthSignals.PlanPhase.DELOAD
                || "PROTECT".equals(input.recoveryGate())) {
            return 1;
        }
        return 2;
    }

    private int scoreDay(RunnerStrengthSignals input,
            List<RunnerStrengthSignals.RunDaySignal> schedule,
            RunnerStrengthSignals.RunDaySignal day,
            RunnerStrengthSignals.StrengthDose dose) {
        RunnerStrengthSignals.RunDaySignal previousDay = signalFor(schedule, day.date().minusDays(1));
        if (isRace(day) || day.keyRun() || day.longRun()
                || (previousDay != null && previousDay.longRun())
                || preRunBuffer(schedule, day.date(), dose) != BufferType.NONE) {
            return Integer.MIN_VALUE;
        }

        int score = input.preferredStrengthDays().contains(day.date().getDayOfWeek()) ? 30 : 0;
        score += switch (day.workoutType()) {
            case "REST" -> 20;
            case "RECOVERY" -> 15;
            case "EASY" -> 10;
            default -> -20;
        };
        if (!"OPEN".equals(input.recoveryGate())) {
            score -= 20;
        }
        if (input.recentHardRuns7d() >= 3) {
            score -= 15;
        }
        return score;
    }

    private BufferType preRunBuffer(List<RunnerStrengthSignals.RunDaySignal> schedule,
            LocalDate date,
            RunnerStrengthSignals.StrengthDose dose) {
        int daysToCheck = dose == RunnerStrengthSignals.StrengthDose.STRONG ? 2 : 1;
        boolean keyRun = false;
        boolean longRun = false;
        for (int offset = 1; offset <= daysToCheck; offset++) {
            RunnerStrengthSignals.RunDaySignal upcoming = signalFor(schedule, date.plusDays(offset));
            if (upcoming == null) {
                continue;
            }
            if (isRace(upcoming)) {
                return BufferType.RACE;
            }
            keyRun |= upcoming.keyRun();
            longRun |= upcoming.longRun();
        }
        if (keyRun) {
            return BufferType.KEY;
        }
        return longRun ? BufferType.LONG : BufferType.NONE;
    }

    private String noStrengthReason(RunnerStrengthSignals input,
            List<RunnerStrengthSignals.RunDaySignal> schedule,
            RunnerStrengthSignals.RunDaySignal day,
            RunnerStrengthSignals.StrengthDose dose,
            List<LocalDate> selectedDates,
            int[] selectedByWeek,
            int weeklyTarget) {
        if (noSessionState(input)) {
            return "SAFETY_NO_SESSION";
        }
        if (isRace(day)) {
            return "RACE_DAY_NO_PRIMARY_STRENGTH";
        }
        if (day.keyRun()) {
            return "KEY_RUN_DAY";
        }
        if (day.longRun()) {
            return "LONG_RUN_DAY";
        }
        RunnerStrengthSignals.RunDaySignal previousDay = signalFor(schedule, day.date().minusDays(1));
        if (previousDay != null && previousDay.longRun()) {
            return "LONG_RUN_RECOVERY";
        }
        BufferType buffer = preRunBuffer(schedule, day.date(), dose);
        if (buffer == BufferType.KEY) {
            return "KEY_RUN_BUFFER";
        }
        if (buffer == BufferType.LONG) {
            return "LONG_RUN_BUFFER";
        }
        if (buffer == BufferType.RACE) {
            return "NOT_SELECTED";
        }
        if (!hasFullRecoveryDay(selectedDates, day.date())) {
            return "STRENGTH_RECOVERY_DAY";
        }
        if (selectedByWeek[weekIndex(input.today(), day.date())] >= weeklyTarget) {
            return "WEEKLY_CAP_REACHED";
        }
        return "NOT_SELECTED";
    }

    private RunnerStrengthSignals.StrengthFocus appliedFocus(RunnerStrengthSignals input,
            RunnerStrengthSignals.PlanPhase phase) {
        if (input.requestedFocus() != RunnerStrengthSignals.StrengthFocus.COACH_PICK) {
            return input.requestedFocus();
        }
        return phase == RunnerStrengthSignals.PlanPhase.DELOAD
                ? RunnerStrengthSignals.StrengthFocus.CORE_STABILITY
                : RunnerStrengthSignals.StrengthFocus.LEG_DAY;
    }

    private DoseDecision safeDose(RunnerStrengthSignals input,
            RunnerStrengthSignals.PlanPhase phase,
            List<RunnerStrengthSignals.RunDaySignal> schedule) {
        BufferType requestedBuffer = preRunBuffer(schedule, input.today(), input.requestedDose());
        boolean manualKeyBuffer = isManualRequest(input)
                && input.requestedDose() == RunnerStrengthSignals.StrengthDose.STRONG
                && requestedBuffer == BufferType.KEY;
        if (input.requestedFocus() == RunnerStrengthSignals.StrengthFocus.MOBILITY_RESET) {
            return new DoseDecision(
                    RunnerStrengthSignals.StrengthDose.MICRO,
                    false,
                    false,
                    false,
                    manualKeyBuffer,
                    input.requestedDose() != RunnerStrengthSignals.StrengthDose.MICRO,
                    false,
                    false
            );
        }
        if (input.raceWeek() || phase == RunnerStrengthSignals.PlanPhase.DELOAD) {
            return new DoseDecision(RunnerStrengthSignals.StrengthDose.MICRO, false,
                    input.raceWeek() && input.requestedDose() != RunnerStrengthSignals.StrengthDose.MICRO,
                    false, manualKeyBuffer, false,
                    phase == RunnerStrengthSignals.PlanPhase.DELOAD
                            && input.requestedDose() != RunnerStrengthSignals.StrengthDose.MICRO,
                    false);
        }
        if ("PROTECT".equals(input.recoveryGate())) {
            return new DoseDecision(RunnerStrengthSignals.StrengthDose.MICRO,
                    input.requestedDose() != RunnerStrengthSignals.StrengthDose.MICRO,
                    false, false, manualKeyBuffer, false, false, false);
        }
        if (!"OPEN".equals(input.recoveryGate()) && input.requestedDose() == RunnerStrengthSignals.StrengthDose.STRONG) {
            return new DoseDecision(RunnerStrengthSignals.StrengthDose.MICRO,
                    true, false, false, manualKeyBuffer, false, false, false);
        }
        if (manualKeyBuffer) {
            return new DoseDecision(RunnerStrengthSignals.StrengthDose.STANDARD,
                    false, false, false, true, false, false, false);
        }
        if ((lowDataConservative(input) || input.experienceLevel() == MuscleTrainingPreference.ExperienceLevel.BEGINNER)
                && input.requestedDose() == RunnerStrengthSignals.StrengthDose.STRONG) {
            return new DoseDecision(RunnerStrengthSignals.StrengthDose.STANDARD, false, false,
                    lowDataConservative(input), false, false, false,
                    input.experienceLevel() == MuscleTrainingPreference.ExperienceLevel.BEGINNER);
        }
        return new DoseDecision(input.requestedDose(), false, false, false, false, false, false, false);
    }

    private List<String> sessionReasons(RunnerStrengthSignals input,
            DoseDecision doseDecision) {
        List<String> reasons = new ArrayList<>();
        if (input.requestedFocus() != RunnerStrengthSignals.StrengthFocus.COACH_PICK) {
            reasons.add("MANUAL_FOCUS_PRESERVED");
        }
        if (doseDecision.mobilityResetRecovery()) {
            reasons.add("MOBILITY_RESET_RECOVERY");
        }
        if (doseDecision.manualKeyBufferExplanation()) {
            reasons.add("KEY_RUN_BUFFER");
        }
        if (doseDecision.recoveryDowngrade()) {
            reasons.add("RECOVERY_DOWNGRADE");
        }
        if (doseDecision.raceWeekDeload()) {
            reasons.add("RACE_WEEK_DELOAD");
        }
        if (doseDecision.phaseDeload()) {
            reasons.add("DELOAD_DOSE_CAP");
        }
        if (doseDecision.lowDataConservative()) {
            reasons.add("LOW_DATA_CONSERVATIVE");
        }
        if (doseDecision.beginnerDoseCap()) {
            reasons.add("BEGINNER_DOSE_CAP");
        }
        return List.copyOf(reasons);
    }

    private PersonalizedStrengthPlan.SafetyAdjustment safetyAdjustment(RunnerStrengthSignals input,
            List<LocalDate> selectedDates,
            RunnerStrengthSignals.StrengthFocus appliedFocus,
            RunnerStrengthSignals.StrengthDose appliedDose,
            List<String> reasonCodes) {
        if (!isManualRequest(input)) {
            return null;
        }
        if (selectedDates.isEmpty()) {
            return new PersonalizedStrengthPlan.SafetyAdjustment(
                    input.requestedFocus(),
                    input.requestedDose(),
                    null,
                    null,
                    RunnerStrengthSignals.SafetyAction.SUPPRESSED,
                    List.of("SAFETY_NO_SESSION")
            );
        }
        LocalDate appliedDate = selectedDates.stream().min(LocalDate::compareTo).orElseThrow();
        RunnerStrengthSignals.SafetyAction action = actionFor(input, appliedDate, appliedDose);
        if (action == RunnerStrengthSignals.SafetyAction.NONE) {
            return null;
        }
        return new PersonalizedStrengthPlan.SafetyAdjustment(
                input.requestedFocus(),
                input.requestedDose(),
                appliedFocus,
                appliedDose,
                action,
                List.copyOf(reasonCodes)
        );
    }

    private RunnerStrengthSignals.SafetyAction actionFor(RunnerStrengthSignals input,
            LocalDate date,
            RunnerStrengthSignals.StrengthDose appliedDose) {
        if (!isManualRequest(input)) {
            return RunnerStrengthSignals.SafetyAction.NONE;
        }
        boolean relocated = !input.today().equals(date);
        boolean downgraded = input.requestedDose() != appliedDose;
        if (relocated && downgraded) {
            return RunnerStrengthSignals.SafetyAction.RELOCATED_AND_DOWNGRADED;
        }
        if (relocated) {
            return RunnerStrengthSignals.SafetyAction.RELOCATED;
        }
        if (downgraded) {
            return RunnerStrengthSignals.SafetyAction.DOWNGRADED;
        }
        return RunnerStrengthSignals.SafetyAction.NONE;
    }

    private boolean hasFullRecoveryDay(List<LocalDate> selectedDates, LocalDate candidate) {
        return selectedDates.stream().noneMatch(selected -> Math.abs(ChronoUnit.DAYS.between(selected, candidate)) < 2);
    }

    private int weekIndex(LocalDate start, LocalDate date) {
        return (int) (ChronoUnit.DAYS.between(start, date) / 7);
    }

    private RunnerStrengthSignals.RunDaySignal signalFor(List<RunnerStrengthSignals.RunDaySignal> schedule, LocalDate date) {
        return schedule.stream().filter(day -> date.equals(day.date())).findFirst().orElse(null);
    }

    private boolean isRace(RunnerStrengthSignals.RunDaySignal day) {
        return day.raceDay();
    }

    private boolean noSessionState(RunnerStrengthSignals input) {
        return input.strengthSuppressed()
                || "HIGH".equals(input.sorenessLevel())
                || "HIGH".equals(input.injuryRisk());
    }

    private boolean lowDataConservative(RunnerStrengthSignals input) {
        return input.conservativeData()
                || input.missingSignals().contains("RUN_HISTORY")
                || input.missingSignals().contains("RUN_SCHEDULE");
    }

    private boolean isManualRequest(RunnerStrengthSignals input) {
        return input.manualStrengthRequest();
    }

    private RunnerStrengthSignals.Confidence confidenceFor(List<String> missingSignals) {
        if (missingSignals.contains("RUN_SCHEDULE") || missingSignals.contains("RUN_HISTORY")) {
            return RunnerStrengthSignals.Confidence.LOW;
        }
        return missingSignals.isEmpty()
                ? RunnerStrengthSignals.Confidence.HIGH
                : RunnerStrengthSignals.Confidence.MEDIUM;
    }

    private record Candidate(RunnerStrengthSignals.RunDaySignal day, int score) {
    }

    private record DoseDecision(
            RunnerStrengthSignals.StrengthDose dose,
            boolean recoveryDowngrade,
            boolean raceWeekDeload,
            boolean lowDataConservative,
            boolean manualKeyBufferExplanation,
            boolean mobilityResetRecovery,
            boolean phaseDeload,
            boolean beginnerDoseCap
    ) {
    }

    private enum BufferType {
        NONE,
        RACE,
        KEY,
        LONG
    }
}
