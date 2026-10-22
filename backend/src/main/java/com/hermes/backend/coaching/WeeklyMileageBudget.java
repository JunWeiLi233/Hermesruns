package com.hermes.backend.coaching;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import com.hermes.backend.coaching.PlannedSession;

/** Debit actual mileage before capping the remaining automatic prescriptions, one Monday–Sunday week at a time. */
public final class WeeklyMileageBudget {
    private WeeklyMileageBudget() {}

    public record Week(LocalDate start, LocalDate end, double budgetKm, double completedKm,
                       double remainingAllowanceKm, double scheduledRemainingKm, double projectedTotalKm) {}
    public record Allocation(List<PlannedSession> sessions, List<Week> weeks) {}

    /** Full-week comparison plan. Actual mileage is debited only by allocate(), never from this baseline. */
    public static List<PlannedSession> planWeek(double budgetKm, List<PlannedSession> drafts) {
        if (drafts.isEmpty()) return List.of();
        long budget = Math.round(Math.max(0, Double.isFinite(budgetKm) ? budgetKm : 0) * 10);
        long race = drafts.stream().filter(s -> "race".equals(s.intent()))
                .mapToLong(s -> Math.round(runningKm(s) * 10)).sum();
        if (race > budget) return allocate(drafts.get(0).date(), budgetKm, drafts, Map.of()).sessions();
        var training = java.util.stream.IntStream.range(0, drafts.size())
                .filter(i -> !"race".equals(drafts.get(i).intent()) && runningKm(drafts.get(i)) > 0).boxed().toList();
        double totalWeight = training.stream().mapToDouble(i -> runningKm(drafts.get(i))).sum();
        if (totalWeight <= 0) return List.copyOf(drafts);
        long remaining = budget - race;
        long[] tenths = new long[drafts.size()];
        double[] fractions = new double[drafts.size()];
        long assigned = 0;
        for (int index : training) {
            double share = remaining * runningKm(drafts.get(index)) / totalWeight;
            tenths[index] = (long) Math.floor(share);
            fractions[index] = share - tenths[index];
            assigned += tenths[index];
        }
        var rounded = training.stream().sorted(java.util.Comparator.<Integer>comparingDouble(i -> -fractions[i])
                .thenComparing(i -> drafts.get(i).date())).toList();
        for (int index = 0; index < remaining - assigned; index++) tenths[rounded.get(index)]++;
        var result = new ArrayList<PlannedSession>();
        for (int index = 0; index < drafts.size(); index++) {
            var draft = drafts.get(index);
            if ("race".equals(draft.intent()) || runningKm(draft) <= 0) {
                result.add(draft);
            } else if (tenths[index] == 0) {
                result.add(rest(draft, "weekly_budget_exhausted"));
            } else {
                double km = tenths[index] / 10d;
                result.add(new PlannedSession(draft.date(), draft.workoutType(), km,
                        draft.durationMinutes() == null ? null : Math.max(1, (int) Math.round(draft.durationMinutes() * km / draft.distanceKm())),
                        draft.stridesSuggested(), draft.phase(), draft.intent(), draft.reasonCode(),
                        draft.targetPaceMinSecondsPerKm(), draft.targetPaceMaxSecondsPerKm(), draft.mutatedFrom(),
                        draft.readinessAdjusted(), draft.originalDistanceKm()));
            }
        }
        return List.copyOf(result);
    }

    public static Allocation allocate(LocalDate today, double budgetKm, List<PlannedSession> drafts,
                                      Map<LocalDate, Double> completedByDate) {
        var result = new ArrayList<PlannedSession>();
        var weeks = new ArrayList<Week>();
        if (drafts.isEmpty()) return new Allocation(List.of(), List.of());
        LocalDate first = monday(today);
        LocalDate last = monday(drafts.get(drafts.size() - 1).date());
        for (LocalDate start = first; !start.isAfter(last); start = start.plusWeeks(1)) {
            LocalDate end = start.plusDays(6);
            final LocalDate weekStart = start;
            double completed = completedByDate.entrySet().stream()
                    .filter(e -> !e.getKey().isBefore(weekStart) && !e.getKey().isAfter(end) && !e.getKey().isAfter(today))
                    .mapToDouble(Map.Entry::getValue).sum();
            double allowance = floor1(Math.max(0, budgetKm - completed));
            var candidates = drafts.stream().filter(s -> !s.date().isBefore(weekStart) && !s.date().isAfter(end)
                    && !s.date().isBefore(today)).toList();
            double raceKm = candidates.stream().filter(s -> "race".equals(s.intent()) && !completedByDate.containsKey(s.date()))
                    .mapToDouble(WeeklyMileageBudget::runningKm).sum();
            double requested = candidates.stream().filter(s -> !"race".equals(s.intent()) && !completedByDate.containsKey(s.date()))
                    .mapToDouble(WeeklyMileageBudget::runningKm).sum();
            boolean raceFits = raceKm <= allowance;
            double trainingAllowance = raceFits ? allowance - raceKm : 0;
            double scale = requested > trainingAllowance && requested > 0 ? trainingAllowance / requested : 1;
            double scheduled = 0;
            for (var draft : candidates) {
                PlannedSession session = draft;
                if (completedByDate.containsKey(draft.date()) && !draft.date().isAfter(today)) {
                    session = rest(draft, "run_completed");
                } else if (allowance <= 0 || ("race".equals(draft.intent()) && !raceFits)) {
                    session = rest(draft, "weekly_budget_exhausted");
                } else if (runningKm(draft) > 0 && !"race".equals(draft.intent()) && scale < 1) {
                    double distance = floor1(runningKm(draft) * scale);
                    session = distance <= 0 ? rest(draft, "weekly_budget_exhausted") : new PlannedSession(
                            draft.date(), draft.workoutType(), distance,
                            draft.durationMinutes() == null ? null : Math.max(1, (int) Math.floor(draft.durationMinutes() * distance / draft.distanceKm())),
                            draft.stridesSuggested(), draft.phase(), draft.intent(), draft.reasonCode(),
                            draft.targetPaceMinSecondsPerKm(), draft.targetPaceMaxSecondsPerKm(),
                            draft.mutatedFrom(), draft.readinessAdjusted(), draft.distanceKm());
                }
                scheduled += runningKm(session);
                result.add(session);
            }
            scheduled = Math.round(scheduled * 10) / 10d;
            weeks.add(new Week(start, end, budgetKm, completed, allowance, scheduled, completed + scheduled));
        }
        return new Allocation(List.copyOf(result), List.copyOf(weeks));
    }

    public static LocalDate monday(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }
    private static double runningKm(PlannedSession session) {
        return session.workoutType() == CoachWorkoutType.REST || session.workoutType() == CoachWorkoutType.CROSS_TRAIN
                || session.distanceKm() == null ? 0 : session.distanceKm();
    }
    private static double floor1(double value) { return Math.floor((value + 1e-9) * 10) / 10d; }
    private static PlannedSession rest(PlannedSession session, String reason) {
        return new PlannedSession(session.date(), CoachWorkoutType.REST, null, null, false, session.phase(),
                "rest", reason, null, null, session.workoutType() == CoachWorkoutType.REST ? session.mutatedFrom() : session.workoutType(), true,
                session.originalDistanceKm() == null ? session.distanceKm() : session.originalDistanceKm());
    }
}
