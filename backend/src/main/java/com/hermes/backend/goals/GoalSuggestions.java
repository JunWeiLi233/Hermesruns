package com.hermes.backend.goals;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Goals worth setting, worked out from the runner's own recent running (see docs/README-ANALYSIS.md, "Suggested goals").
 *
 * <p>The rule is the same for everyone and is shown with every suggestion: a usual week, month or year of the runner's own,
 * and a target a little above it (10% for a week or a month, 5% for a year), rounded to a number a person would pick. A
 * distance, time or climb target is never at or below the usual figure it comes from; the number of runs is the usual
 * number, because more runs is not what a runner who runs three times a week is asking for. Nothing is suggested before
 * there is something to go on: at least four active weeks, and six runs, in the last eight complete weeks. A goal the
 * runner already has is not suggested again. This is arithmetic, not a model, and nothing leaves the server.</p>
 */
public final class GoalSuggestions {

    /** How many complete weeks (Monday to Sunday, before the current one) a usual week is taken from. */
    public static final int WEEKS = 8;
    /** How many complete calendar months a usual month is taken from. */
    public static final int MONTHS = 3;
    /** The days a usual year is taken from: the last year, not the calendar year, so January is not empty. */
    public static final int YEAR_DAYS = 365;
    public static final int MIN_ACTIVE_WEEKS = 4;
    public static final int MIN_RUNS = 6;
    public static final double WEEK_AND_MONTH_STRETCH = 0.10;
    public static final double YEAR_STRETCH = 0.05;
    /** A weekly climb target is only offered to a runner whose usual week climbs at least this many metres. */
    static final double MIN_USUAL_WEEKLY_CLIMB = 100.0;

    /** One day's running as a goal counts it: kilometres, seconds of moving time, runs and metres of climb. */
    public record Day(LocalDate day, double km, double seconds, int runs, double climbM) {
    }

    /** What a suggestion rests on: the kind of figure, how much history it covers, the usual figure and the stretch added. */
    public record Basis(String kind, int span, double usual, int stretchPercent) {
    }

    public record Suggestion(String period, String metric, String unit, double target, Basis basis) {
    }

    private GoalSuggestions() {
    }

    /**
     * @param days     the runner's running by day (any order), covering at least the last year
     * @param today    the runner's today
     * @param existing {@code "PERIOD/METRIC"} of the goals the runner has
     * @return suggestions in the order they are worth offering; empty when there is not enough running to go on
     */
    public static List<Suggestion> suggest(List<Day> days, LocalDate today, Set<String> existing) {
        Weeks weeks = lastWeeks(days, today);
        if (!weeks.enough()) {
            return List.of();
        }
        return suggestFrom(weeks, days, today, existing);
    }

    /** True when there is enough running in the last {@link #WEEKS} complete weeks to suggest anything. */
    public static boolean enoughRunning(List<Day> days, LocalDate today) {
        return lastWeeks(days, today).enough();
    }

    private record Weeks(double[] km, double[] seconds, double[] climb, int[] runs, int activeWeeks, int totalRuns) {
        boolean enough() {
            return activeWeeks >= MIN_ACTIVE_WEEKS && totalRuns >= MIN_RUNS;
        }
    }

    /** The last {@link #WEEKS} complete weeks (Monday to Sunday, before the current one), oldest first. */
    private static Weeks lastWeeks(List<Day> days, LocalDate today) {
        LocalDate thisMonday = GoalPeriods.start(GoalPeriods.WEEK, today);
        LocalDate firstWeek = thisMonday.minusWeeks(WEEKS);

        // The last WEEKS complete weeks, oldest first.
        double[] km = new double[WEEKS];
        double[] seconds = new double[WEEKS];
        double[] climb = new double[WEEKS];
        int[] runs = new int[WEEKS];
        for (Day day : days) {
            if (day.day().isBefore(firstWeek) || !day.day().isBefore(thisMonday)) {
                continue;
            }
            int week = (int) ((day.day().toEpochDay() - firstWeek.toEpochDay()) / 7);
            km[week] += day.km();
            seconds[week] += day.seconds();
            climb[week] += day.climbM();
            runs[week] += day.runs();
        }
        int activeWeeks = 0;
        int totalRuns = 0;
        for (int i = 0; i < WEEKS; i++) {
            if (runs[i] > 0) {
                activeWeeks++;
            }
            totalRuns += runs[i];
        }
        return new Weeks(km, seconds, climb, runs, activeWeeks, totalRuns);
    }

    private static List<Suggestion> suggestFrom(Weeks weeks, List<Day> days, LocalDate today, Set<String> existing) {
        double[] km = weeks.km();
        double[] seconds = weeks.seconds();
        double[] climb = weeks.climb();
        int[] runs = weeks.runs();
        int activeWeeks = weeks.activeWeeks();
        Map<String, Suggestion> offered = new LinkedHashMap<>();
        double usualKm = mean(km, runs);
        double usualRuns = meanRuns(runs);
        double usualSeconds = mean(seconds, runs);
        double usualClimb = mean(climb, runs);

        add(offered, existing, new Suggestion(GoalPeriods.WEEK, GoalMetrics.DISTANCE, "km",
                above(usualKm, WEEK_AND_MONTH_STRETCH, step(usualKm)), new Basis("weekly-average", activeWeeks, round1(usualKm), 10)));
        add(offered, existing, new Suggestion(GoalPeriods.WEEK, GoalMetrics.COUNT, "runs",
                Math.max(2, Math.min(7, Math.round(usualRuns))), new Basis("weekly-average", activeWeeks, round1(usualRuns), 0)));

        Double monthKm = usualMonthKm(days, today);
        if (monthKm != null) {
            add(offered, existing, new Suggestion(GoalPeriods.MONTH, GoalMetrics.DISTANCE, "km",
                    above(monthKm, WEEK_AND_MONTH_STRETCH, step(monthKm)), new Basis("monthly-average", MONTHS, round1(monthKm), 10)));
        }
        Double yearKm = lastYearKm(days, today);
        if (yearKm != null) {
            add(offered, existing, new Suggestion(GoalPeriods.YEAR, GoalMetrics.DISTANCE, "km",
                    above(yearKm, YEAR_STRETCH, step(yearKm)), new Basis("yearly-total", YEAR_DAYS, round1(yearKm), 5)));
        }
        add(offered, existing, new Suggestion(GoalPeriods.WEEK, GoalMetrics.TIME, "s",
                aboveSeconds(usualSeconds), new Basis("weekly-average", activeWeeks, Math.round(usualSeconds), 10)));
        if (usualClimb >= MIN_USUAL_WEEKLY_CLIMB) {
            add(offered, existing, new Suggestion(GoalPeriods.WEEK, GoalMetrics.ELEVATION, "m",
                    above(usualClimb, WEEK_AND_MONTH_STRETCH, 50.0), new Basis("weekly-average", activeWeeks, Math.round(usualClimb), 10)));
        }
        return new ArrayList<>(offered.values());
    }

    private static void add(Map<String, Suggestion> offered, Set<String> existing, Suggestion suggestion) {
        String key = suggestion.period() + "/" + suggestion.metric();
        if (!existing.contains(key) && suggestion.target() > 0) {
            offered.put(key, suggestion);
        }
    }

    /** The mean of the weeks that had a run. */
    private static double mean(double[] values, int[] runs) {
        double sum = 0;
        int weeks = 0;
        for (int i = 0; i < values.length; i++) {
            if (runs[i] > 0) {
                sum += values[i];
                weeks++;
            }
        }
        return weeks == 0 ? 0 : sum / weeks;
    }

    private static double meanRuns(int[] runs) {
        double sum = 0;
        int weeks = 0;
        for (int count : runs) {
            if (count > 0) {
                sum += count;
                weeks++;
            }
        }
        return weeks == 0 ? 0 : sum / weeks;
    }

    /** The mean distance of the last complete calendar months that had a run; null when fewer than two did. */
    private static Double usualMonthKm(List<Day> days, LocalDate today) {
        LocalDate firstOfThisMonth = today.withDayOfMonth(1);
        double sum = 0;
        int active = 0;
        for (int back = 1; back <= MONTHS; back++) {
            LocalDate from = firstOfThisMonth.minusMonths(back);
            LocalDate to = from.plusMonths(1);
            double km = 0;
            int runs = 0;
            for (Day day : days) {
                if (!day.day().isBefore(from) && day.day().isBefore(to)) {
                    km += day.km();
                    runs += day.runs();
                }
            }
            if (runs > 0) {
                sum += km;
                active++;
            }
        }
        return active < 2 ? null : sum / active;
    }

    /** The distance of the last {@link #YEAR_DAYS} days; null unless the runner ran in at least six of the twelve months. */
    private static Double lastYearKm(List<Day> days, LocalDate today) {
        LocalDate from = today.minusDays(YEAR_DAYS - 1L);
        double km = 0;
        Set<Integer> months = new java.util.HashSet<>();
        for (Day day : days) {
            if (!day.day().isBefore(from) && !day.day().isAfter(today) && day.runs() > 0) {
                km += day.km();
                months.add(day.day().getYear() * 12 + day.day().getMonthValue());
            }
        }
        return months.size() < 6 ? null : km;
    }

    /** A step a person would count in at that size: a kilometre for a short week, fifty for a big year. */
    static double step(double value) {
        if (value < 20) return 1;
        if (value < 60) return 5;
        if (value < 200) return 10;
        if (value < 600) return 25;
        if (value < 2000) return 50;
        return 100;
    }

    /** The usual figure plus the stretch, rounded to the step, and always more than the usual figure. */
    static double above(double usual, double stretch, double step) {
        double target = Math.round(usual * (1 + stretch) / step) * step;
        if (target <= usual) {
            target += step;
        }
        return Math.max(step, target);
    }

    /** Weekly time, to the quarter hour, at least half an hour and always more than the usual week. */
    private static double aboveSeconds(double usual) {
        double quarter = 900.0;
        double target = Math.round(usual * (1 + WEEK_AND_MONTH_STRETCH) / quarter) * quarter;
        if (target <= usual) {
            target += quarter;
        }
        return Math.max(1800.0, target);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
