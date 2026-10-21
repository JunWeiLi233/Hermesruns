package com.hermes.backend.coaching;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A runner's total effort for each week, set against the range of their own last three weeks.
 *
 * <p>A week is Monday to Sunday (ISO) on the runner's own calendar. The usual range of a week is the mean of the three
 * weeks before it, give or take a band (20% by default): a week of {@code 300, 350, 400} before it gives a mean of 350
 * and a range of 280 to 420. A week that ended is <em>below</em>, <em>within</em> or <em>above</em> that range. A week
 * still going cannot be below yet, because the days left may still add to it, so it is <em>above</em> or
 * <em>within</em> already, or <em>building</em> towards the range.</p>
 *
 * <p>A week has no range (<em>none</em>) when the runner has not been running for the three weeks before it, because
 * a week off after the first run is a real week of zero, while a week before the first run is not a week at all, and
 * when the mean of the three is too small to say anything. Like fitness, this is arithmetic on what it is given.</p>
 */
final class WeeklyEffortModel {

    /** Below this mean weekly effort the "usual range" is just noise (a week of one short, easy jog). */
    static final double MIN_USUAL_EFFORT = 5.0;

    /** How a week compares with its range. */
    enum Status {
        BELOW, WITHIN, ABOVE, BUILDING, NONE;

        String code() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    record Range(double low, double high, double average) {
    }

    record Week(LocalDate start, LocalDate end, double total, int runs, boolean complete, Range range, Status status) {
    }

    private WeeklyEffortModel() {
    }

    static LocalDate weekStart(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * The last {@code weekCount} weeks up to and including the week of {@code today}, oldest first. A week that ended
     * before the runner's first run is left out, so a new runner gets a short list rather than a row of empty weeks.
     *
     * @param effortByDay the effort of each day that had a run
     * @param runsByDay   how many runs each day had
     * @param firstLoadDay the day of the runner's first run with an effort, or null when there is none
     * @param band        the share of the mean that makes the range, 0.2 for 20%
     */
    static List<Week> weeks(Map<LocalDate, Double> effortByDay, Map<LocalDate, Integer> runsByDay,
                            LocalDate today, LocalDate firstLoadDay, int weekCount, double band) {
        List<Week> weeks = new ArrayList<>();
        if (firstLoadDay == null || weekCount < 1) {
            return weeks;
        }
        LocalDate currentStart = weekStart(today);
        for (int back = weekCount - 1; back >= 0; back--) {
            LocalDate start = currentStart.minusWeeks(back);
            LocalDate end = start.plusDays(6);
            if (end.isBefore(firstLoadDay)) {
                continue;
            }
            double total = sumEffort(effortByDay, start);
            int runs = countRuns(runsByDay, start);
            boolean complete = end.isBefore(today);
            Range range = usualRange(effortByDay, start, firstLoadDay, band);
            weeks.add(new Week(start, end, total, runs, complete, range, statusOf(total, range, complete)));
        }
        return weeks;
    }

    private static Range usualRange(Map<LocalDate, Double> effortByDay, LocalDate weekStart, LocalDate firstLoadDay, double band) {
        // The three weeks before must all have started after the runner did: the third one back must reach the first run.
        LocalDate thirdBackEnd = weekStart.minusWeeks(3).plusDays(6);
        if (firstLoadDay.isAfter(thirdBackEnd)) {
            return null;
        }
        double sum = 0;
        for (int back = 1; back <= 3; back++) {
            sum += sumEffort(effortByDay, weekStart.minusWeeks(back));
        }
        double average = sum / 3.0;
        if (average < MIN_USUAL_EFFORT) {
            return null;
        }
        return new Range(average * (1.0 - band), average * (1.0 + band), average);
    }

    private static Status statusOf(double total, Range range, boolean complete) {
        if (range == null) {
            return Status.NONE;
        }
        if (total > range.high()) {
            return Status.ABOVE;
        }
        if (total >= range.low()) {
            return Status.WITHIN;
        }
        return complete ? Status.BELOW : Status.BUILDING;
    }

    private static double sumEffort(Map<LocalDate, Double> effortByDay, LocalDate weekStart) {
        double sum = 0;
        for (int i = 0; i < 7; i++) {
            Double effort = effortByDay.get(weekStart.plusDays(i));
            if (effort != null && !effort.isNaN() && !effort.isInfinite() && effort > 0) {
                sum += effort;
            }
        }
        return sum;
    }

    private static int countRuns(Map<LocalDate, Integer> runsByDay, LocalDate weekStart) {
        int runs = 0;
        for (int i = 0; i < 7; i++) {
            Integer count = runsByDay.get(weekStart.plusDays(i));
            if (count != null && count > 0) {
                runs += count;
            }
        }
        return runs;
    }
}
