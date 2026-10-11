package com.hermes.backend.goals;

import com.hermes.backend.coaching.TrainingLogRepository;
import java.util.List;
import java.util.Map;

/**
 * What a goal can be about, in the unit it is stored in: distance in kilometres, time in seconds of moving time, the number
 * of runs, and climb in metres. Only runs count (Hermes analyses runs only).
 */
public final class GoalMetrics {

    public static final String DISTANCE = "DISTANCE";
    public static final String TIME = "TIME";
    public static final String COUNT = "COUNT";
    public static final String ELEVATION = "ELEVATION";
    public static final List<String> ALL = List.of(DISTANCE, TIME, COUNT, ELEVATION);

    /** The largest target a goal may have, per metric: well past anything a person runs, so a typo cannot store nonsense. */
    public static final Map<String, Double> MAX_TARGET = Map.of(
            DISTANCE, 100_000.0,        // km
            TIME, 31_536_000.0,         // a year of seconds
            COUNT, 10_000.0,            // runs
            ELEVATION, 1_000_000.0);    // m

    private GoalMetrics() {
    }

    public static boolean isValid(String metric) {
        return metric != null && ALL.contains(metric);
    }

    /** The unit a metric's numbers are in over the API. */
    public static String unit(String metric) {
        return switch (metric) {
            case DISTANCE -> "km";
            case TIME -> "s";
            case COUNT -> "runs";
            case ELEVATION -> "m";
            default -> throw new IllegalArgumentException("Not a goal metric: " + metric);
        };
    }

    /**
     * A target as it is stored: distance to the nearest 10 m, the rest to a whole number.
     *
     * @throws IllegalArgumentException with a plain reason when the number is not a usable target
     */
    public static double cleanTarget(String metric, Object raw) {
        if (!(raw instanceof Number number)) {
            throw new IllegalArgumentException("The target must be a number.");
        }
        double value = number.doubleValue();
        if (!Double.isFinite(value) || value <= 0) {
            throw new IllegalArgumentException("The target must be more than zero.");
        }
        double stored = DISTANCE.equals(metric) ? Math.round(value * 100.0) / 100.0 : Math.round(value);
        if (stored <= 0) {
            throw new IllegalArgumentException("The target must be at least " + (DISTANCE.equals(metric) ? "0.01 km." : "1."));
        }
        if (stored > MAX_TARGET.get(metric)) {
            throw new IllegalArgumentException("The target can be at most " + format(MAX_TARGET.get(metric)) + " " + unit(metric) + ".");
        }
        return stored;
    }

    private static String format(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    /** What one run adds to a goal of this metric. */
    public static double of(String metric, TrainingLogRepository.LogRunRow run) {
        return switch (metric) {
            case DISTANCE -> distanceKm(run);
            case TIME -> movingSeconds(run);
            case COUNT -> 1.0;
            case ELEVATION -> run.getElevationGain() == null || run.getElevationGain() < 0 ? 0.0 : run.getElevationGain();
            default -> throw new IllegalArgumentException("Not a goal metric: " + metric);
        };
    }

    private static double distanceKm(TrainingLogRepository.LogRunRow run) {
        if (run.getDistanceKm() != null && run.getDistanceKm() > 0) {
            return run.getDistanceKm();
        }
        return run.getDistanceMeters() != null && run.getDistanceMeters() > 0 ? run.getDistanceMeters() / 1000.0 : 0.0;
    }

    private static double movingSeconds(TrainingLogRepository.LogRunRow run) {
        if (run.getMovingTimeSeconds() != null && run.getMovingTimeSeconds() > 0) {
            return run.getMovingTimeSeconds();
        }
        return run.getDurationSeconds() != null && run.getDurationSeconds() > 0 ? run.getDurationSeconds() : 0.0;
    }
}
