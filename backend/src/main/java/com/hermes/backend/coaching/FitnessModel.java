package com.hermes.backend.coaching;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Fitness, fatigue and form from a runner's daily effort: two exponentially weighted averages of the same daily
 * numbers, one slow and one fast, and the gap between them (the impulse-response model of Banister et al. 1975, in the
 * form training software has used since: Coggan's chronic and acute training load).
 *
 * <pre>
 * fitness(t) = fitness(t-1) + (load(t) - fitness(t-1)) * (1 - e^(-1/fitnessDays))      slow, 42 days by default
 * fatigue(t) = fatigue(t-1) + (load(t) - fatigue(t-1)) * (1 - e^(-1/fatigueDays))      fast, 7 days by default
 * form(t)    = fitness(t) - fatigue(t)
 * </pre>
 *
 * <p>Both averages start at zero the day before the first day given, and a day without a run is a day of zero load:
 * rest is what makes fatigue fall faster than fitness, which is what form measures. The units are those of the load
 * (here the run Effort score, a day's total), so fitness is, roughly, the runner's average effort per day over the
 * last six weeks or so.</p>
 *
 * <p>The numbers are pure arithmetic on what they are given: no database, no clock, no runner. The time constants are
 * the common convention, not any one product's; they are settings ({@code app.training.fitness-days},
 * {@code app.training.fatigue-days}).</p>
 */
final class FitnessModel {

    /** One day of the model: the day's load and where fitness, fatigue and form stood at the end of it. */
    record Day(LocalDate date, double load, double fitness, double fatigue, double form) {
    }

    private FitnessModel() {
    }

    /** How much of the gap between the average and the day's load is closed in one day. */
    static double smoothing(int timeConstantDays) {
        if (timeConstantDays < 1) {
            throw new IllegalArgumentException("A time constant is at least one day.");
        }
        return 1.0 - Math.exp(-1.0 / timeConstantDays);
    }

    /**
     * Every day from {@code start} to {@code end}, both included.
     *
     * @param loadByDay the load of each day that had any; a day that is missing, or has a negative or non-numeric
     *                  load, counts as zero
     * @return the days in order, empty when {@code end} is before {@code start}
     */
    static List<Day> run(Map<LocalDate, Double> loadByDay, LocalDate start, LocalDate end, int fitnessDays, int fatigueDays) {
        double slow = smoothing(fitnessDays);
        double fast = smoothing(fatigueDays);
        List<Day> days = new ArrayList<>();
        double fitness = 0;
        double fatigue = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            double load = cleanLoad(loadByDay.get(date));
            fitness += (load - fitness) * slow;
            fatigue += (load - fatigue) * fast;
            days.add(new Day(date, load, fitness, fatigue, fitness - fatigue));
        }
        return days;
    }

    /**
     * Where fitness, fatigue and form would be on each of the next days if the runner did not run at all: each
     * average only decays, so fatigue falls faster than fitness and form rises.
     *
     * @return {@code days} entries, the first of them the day after {@code last}
     */
    static List<Day> restProjection(Day last, int days, int fitnessDays, int fatigueDays) {
        List<Day> projection = new ArrayList<>();
        double fitness = last.fitness();
        double fatigue = last.fatigue();
        double slow = Math.exp(-1.0 / fitnessDays);
        double fast = Math.exp(-1.0 / fatigueDays);
        LocalDate date = last.date();
        for (int i = 0; i < days; i++) {
            date = date.plusDays(1);
            fitness *= slow;
            fatigue *= fast;
            projection.add(new Day(date, 0, fitness, fatigue, fitness - fatigue));
        }
        return projection;
    }

    private static double cleanLoad(Double load) {
        return load == null || load.isNaN() || load.isInfinite() || load < 0 ? 0 : load;
    }
}
