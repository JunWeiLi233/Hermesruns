package com.hermes.backend.goals;

import java.time.LocalDate;
import java.util.Map;

/**
 * Where a goal stands, from what the runner has done and the day it is. Pure arithmetic, so every number can be checked
 * without a database (see docs/README-ANALYSIS.md, "Goals").
 *
 * <p>Whether a runner is on pace is judged on the days that are over: at the start of today the runner should have
 * {@code target x days gone / days in the period} if they were exactly on target, and that is compared with what they had
 * done by then. Today's own run is not held against them (the day is not over) and is not counted towards "ahead"; it only
 * counts towards the total.</p>
 */
public final class GoalMath {

    /** Within a tenth of the expected amount, either way, is "on track". */
    static final double BAND = 0.1;
    private static final double EPSILON = 1e-9;

    /** How the period before the current one went, against today's target. */
    public record Previous(LocalDate start, LocalDate end, double progress, boolean reached) {
    }

    /**
     * @param daysTotal    days in the period
     * @param daysLeft     days from today to the end of the period, today counted (so 1 on the last day)
     * @param progress     what the runner has done so far this period, today included
     * @param remaining    what is left to do, 0 once the goal is reached
     * @param percent      progress as a whole percentage of the target, rounded down, over 100 once it is passed
     * @param neededPerDay what each of the days left must bring to reach the goal; null once it is reached
     * @param expectedByNow what the runner would have at the start of today if they were exactly on target
     * @param doneByNow    what they had at the start of today (days before today only)
     * @param status       {@code reached}, {@code early} (no full day has passed yet, so nothing to judge), {@code ahead},
     *                     {@code on_track} or {@code behind}
     */
    public record Assessment(LocalDate start, LocalDate end, int daysTotal, int daysLeft, double progress, double remaining,
                             int percent, boolean reached, Double neededPerDay, double expectedByNow, double doneByNow,
                             String status, Previous previous) {
    }

    private GoalMath() {
    }

    /**
     * @param valueByDay what the runner did on each day (sum of the metric over that day's runs), days with nothing left out
     */
    public static Assessment assess(String period, double target, LocalDate today, Map<LocalDate, Double> valueByDay) {
        LocalDate start = GoalPeriods.start(period, today);
        LocalDate end = GoalPeriods.end(period, today);
        int daysTotal = GoalPeriods.days(start, end);
        int daysGone = GoalPeriods.days(start, today) - 1;          // full days before today
        int daysLeft = daysTotal - daysGone;

        double doneByNow = sum(valueByDay, start, today.minusDays(1));
        double progress = doneByNow + sum(valueByDay, today, today);
        boolean reached = progress + EPSILON >= target;
        double remaining = reached ? 0.0 : target - progress;
        int percent = (int) Math.floor(progress / target * 100.0 + EPSILON);
        Double neededPerDay = reached ? null : remaining / daysLeft;
        double expectedByNow = target * daysGone / daysTotal;

        String status;
        if (reached) {
            status = "reached";
        } else if (daysGone == 0) {
            status = "early";
        } else if (doneByNow + EPSILON >= expectedByNow * (1 + BAND)) {
            status = "ahead";
        } else if (doneByNow + EPSILON >= expectedByNow * (1 - BAND)) {
            status = "on_track";
        } else {
            status = "behind";
        }

        LocalDate previousEnd = start.minusDays(1);
        LocalDate previousStart = GoalPeriods.start(period, previousEnd);
        double previousProgress = sum(valueByDay, previousStart, previousEnd);
        Previous previous = new Previous(previousStart, previousEnd, previousProgress, previousProgress + EPSILON >= target);

        return new Assessment(start, end, daysTotal, daysLeft, progress, remaining, percent, reached, neededPerDay,
                expectedByNow, doneByNow, status, previous);
    }

    private static double sum(Map<LocalDate, Double> valueByDay, LocalDate first, LocalDate last) {
        double total = 0;
        for (Map.Entry<LocalDate, Double> entry : valueByDay.entrySet()) {
            LocalDate day = entry.getKey();
            if (!day.isBefore(first) && !day.isAfter(last)) {
                total += entry.getValue();
            }
        }
        return total;
    }
}
