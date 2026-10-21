package com.hermes.backend.goals;

import com.hermes.backend.coaching.AutomatedCoachService.CoachPlanDto;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Goal targets are a view of the shared coach plan, never a second growth algorithm. */
public final class GoalSuggestions {
    public static final int WEEKS = 8;
    public static final int YEAR_DAYS = 365;
    public static final int MIN_ACTIVE_WEEKS = 4;
    public static final int MIN_RUNS = 6;
    public record Day(LocalDate day, double km, double seconds, int runs, double climbM) {}
    public record Basis(String kind, int span, double usual, int stretchPercent) {}
    public record Suggestion(String period, String metric, String unit, double target, Basis basis) {}
    private GoalSuggestions() {}

    public static boolean enoughRunning(List<Day> days, LocalDate today) {
        LocalDate from = today.minusDays(27);
        return days.stream().filter(d -> valid(d, from, today)).mapToInt(Day::runs).sum() > 0;
    }

    public static List<Suggestion> suggest(List<Day> days, LocalDate today, Set<String> existing, CoachPlanDto plan) {
        if (plan == null || (!enoughRunning(days, today) && !plan.reasonCodes().contains("VERSIONED_PLAN"))) return List.of();
        List<Suggestion> offered = new ArrayList<>();
        // History explains the comparison only. It cannot manufacture or increase a prescription.
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        double km = 0; int runs = 0; Set<LocalDate> activeWeeks = new HashSet<>();
        for (Day day : days) if (valid(day, monday.minusWeeks(WEEKS), monday.minusDays(1))) {
            km += day.km(); runs += day.runs();
            activeWeeks.add(day.day().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        }
        int span = activeWeeks.size();
        boolean distanceComplete = plan.weeklyBudgets() != null && plan.weeklyBudgets().stream()
                .anyMatch(w -> !today.isBefore(w.start()) && !today.isAfter(w.end()) && w.completedKm() >= w.budgetKm());
        int completedRuns = days.stream().filter(d -> valid(d, monday, today)).mapToInt(Day::runs).sum();
        if (!distanceComplete && Double.isFinite(plan.targetWeeklyKm()) && plan.targetWeeklyKm() > 0) {
            add(offered, existing, "DISTANCE", "km", plan.targetWeeklyKm(), span, span == 0 ? 0 : km / span);
        }
        if (completedRuns < plan.sessionsPerWeek() && plan.sessionsPerWeek() > 0 && plan.sessionsPerWeek() <= 7) {
            add(offered, existing, "COUNT", "runs", plan.sessionsPerWeek(), span, span == 0 ? 0 : (double) runs / span);
        }
        return List.copyOf(offered);
    }

    private static boolean valid(Day day, LocalDate from, LocalDate to) {
        return day != null && day.day() != null && !day.day().isBefore(from) && !day.day().isAfter(to)
                && Double.isFinite(day.km()) && day.km() > 0 && day.runs() > 0;
    }
    private static void add(List<Suggestion> out, Set<String> existing, String metric, String unit, double target, int span, double usual) {
        if (!existing.contains("WEEK/" + metric)) {
            out.add(new Suggestion("WEEK", metric, unit, target, new Basis("coach-plan", span, Math.round(usual * 10) / 10d, 0)));
        }
    }
}
