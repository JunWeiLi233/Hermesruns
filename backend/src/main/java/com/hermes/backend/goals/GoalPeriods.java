package com.hermes.backend.goals;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

/**
 * The three lengths of time a goal can cover, on the runner's own calendar: a week is Monday to Sunday (as everywhere else
 * in the analysis), a month is a calendar month and a year is a calendar year.
 */
public final class GoalPeriods {

    public static final String WEEK = "WEEK";
    public static final String MONTH = "MONTH";
    public static final String YEAR = "YEAR";
    public static final List<String> ALL = List.of(WEEK, MONTH, YEAR);

    private GoalPeriods() {
    }

    public static boolean isValid(String period) {
        return period != null && ALL.contains(period);
    }

    /** The first day of the period that {@code day} is in. */
    public static LocalDate start(String period, LocalDate day) {
        return switch (period) {
            case WEEK -> day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> day.withDayOfMonth(1);
            case YEAR -> day.withDayOfYear(1);
            default -> throw new IllegalArgumentException("Not a goal period: " + period);
        };
    }

    /** The last day of the period that {@code day} is in. */
    public static LocalDate end(String period, LocalDate day) {
        return switch (period) {
            case WEEK -> day.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
            case MONTH -> day.with(TemporalAdjusters.lastDayOfMonth());
            case YEAR -> day.with(TemporalAdjusters.lastDayOfYear());
            default -> throw new IllegalArgumentException("Not a goal period: " + period);
        };
    }

    /** The first day of the period before the one {@code day} is in. */
    public static LocalDate previousStart(String period, LocalDate day) {
        return start(period, start(period, day).minusDays(1));
    }

    /** How many days from {@code first} to {@code last}, both counted. */
    public static int days(LocalDate first, LocalDate last) {
        return (int) ChronoUnit.DAYS.between(first, last) + 1;
    }
}
