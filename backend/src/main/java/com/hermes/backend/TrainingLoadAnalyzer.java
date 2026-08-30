package com.hermes.backend;

import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Shared training-load math for the coach subsystem.
 *
 * Research anchors:
 * - EWMA ACWR with lambda = 2/(N+1) over a 7-day acute / 28-day chronic window
 *   (Williams et al. 2017; Gabbett 2016 BJSM "sweet spot" 0.8-1.3, danger >1.5).
 * - Weekly monotony = mean daily load / SD of daily load (Foster's session-RPE
 *   monitoring framework); >2.0 is the classic overreaching flag.
 */
final class TrainingLoadAnalyzer {

    private static final int ACWR_WINDOW_DAYS = 35;
    private static final int MONOTONY_WINDOW_DAYS = 7;
    private static final double HARD_RUN_MIN_KM = 16.0;
    private static final long HARD_RUN_MIN_SECONDS = 90L * 60L;
    private static final double HARD_RUN_HR_FRACTION = 0.88;
    static final double MAX_MONOTONY = 3.0;

    private TrainingLoadAnalyzer() {
    }

    /**
     * TRIMP-like load units from distance and duration: pace is converted to an
     * ACSM VO2 estimate and squared into an intensity ratio (Banister-style
     * weighting where intensity dominates volume).
     */
    static double loadUnits(double km, long seconds) {
        if (km <= 0 || seconds <= 0) return 0;
        double paceSecPerKm = seconds / km;
        double velocity = (1000.0 / paceSecPerKm) * 60.0;
        double vo2 = -4.60 + (0.182258 * velocity) + (0.000104 * velocity * velocity);
        double vo2Fraction = Math.max(0.42, Math.min(1.2, vo2 / 50.0));
        double intensityRatio = vo2Fraction / 0.85;
        return (seconds / 3600.0) * intensityRatio * intensityRatio * 100.0;
    }

    static double loadOf(RunMetricsProjection run) {
        if (run == null) return 0;
        double km = run.getDistanceKm() != null && run.getDistanceKm() > 0
                ? run.getDistanceKm()
                : (run.getDistanceMeters() != null && run.getDistanceMeters() > 0 ? run.getDistanceMeters() / 1000.0 : 0);
        long seconds = movingSeconds(run);
        return loadUnits(km, seconds);
    }

    static long movingSeconds(RunMetricsProjection run) {
        if (run.getMovingTimeSeconds() != null && run.getMovingTimeSeconds() > 0) return run.getMovingTimeSeconds();
        return run.getDurationSeconds() != null && run.getDurationSeconds() > 0 ? run.getDurationSeconds() : 0;
    }

    static Map<LocalDate, Double> dailyLoads(List<RunMetricsProjection> runs, LocalDate start, LocalDate end) {
        Map<LocalDate, Double> dailyLoads = new HashMap<>();
        if (runs == null) return dailyLoads;
        for (RunMetricsProjection run : runs) {
            if (run.getEffectiveStartTime() == null) continue;
            LocalDate day = run.getEffectiveStartTime().toLocalDate();
            if (day.isBefore(start) || day.isAfter(end)) continue;
            dailyLoads.put(day, dailyLoads.getOrDefault(day, 0.0) + loadOf(run));
        }
        return dailyLoads;
    }

    /**
     * EWMA acute:chronic workload ratio ending at {@code end} (inclusive).
     * Returns null while chronic load is still too small to interpret.
     */
    static Double ewmaAcwr(List<RunMetricsProjection> runs, LocalDate end) {
        if (runs == null || runs.isEmpty()) return null;
        LocalDate start = end.minusDays(ACWR_WINDOW_DAYS);
        Map<LocalDate, Double> dailyLoads = dailyLoads(runs, start, end);
        return ewmaAcwrFromDailyLoads(dailyLoads, end);
    }

    static Double ewmaAcwrFromDailyLoads(Map<LocalDate, Double> dailyLoads, LocalDate end) {
        if (dailyLoads == null || dailyLoads.isEmpty()) return null;
        LocalDate start = end.minusDays(ACWR_WINDOW_DAYS);

        Double lastAcwr = null;
        double ewmaA = 0, ewmaC = 0;
        double lambdaA = 2.0 / 8.0;
        double lambdaC = 2.0 / 29.0;

        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            double load = dailyLoads.getOrDefault(day, 0.0);
            if (day.equals(start)) {
                ewmaA = load;
                ewmaC = load;
            } else {
                ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
                ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
            }
            if (ewmaC > 0.5) {
                lastAcwr = ewmaA / ewmaC;
            }
        }
        return lastAcwr;
    }

    /**
     * Foster weekly monotony over the 7 days ending at {@code end} (inclusive,
     * rest days counted as zero load). Returns null when the week has no load.
     */
    static Double weeklyMonotony(List<RunMetricsProjection> runs, LocalDate end) {
        if (runs == null || runs.isEmpty()) return null;
        LocalDate start = end.minusDays(MONOTONY_WINDOW_DAYS - 1L);
        Map<LocalDate, Double> dailyLoads = dailyLoads(runs, start, end);
        double sum = 0;
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            sum += dailyLoads.getOrDefault(day, 0.0);
        }
        double mean = sum / MONOTONY_WINDOW_DAYS;
        if (mean <= 0) return null;
        double variance = 0;
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            double diff = dailyLoads.getOrDefault(day, 0.0) - mean;
            variance += diff * diff;
        }
        double sd = Math.sqrt(variance / MONOTONY_WINDOW_DAYS);
        if (sd < 1e-9) return MAX_MONOTONY;
        return Math.min(MAX_MONOTONY, mean / sd);
    }

    /**
     * Hours between {@code end}-of-day and the most recent hard session on or
     * before {@code end}. Hard = >=88% HRmax, >=16 km, or >=90 min (same rule
     * as the personalized planner). Returns null when no hard session exists
     * in the window.
     */
    static Integer hoursSinceLastHardSession(List<RunMetricsProjection> runs, Integer runnerMaxHr, LocalDate end) {
        if (runs == null || runs.isEmpty()) return null;
        LocalDate windowStart = end.minusDays(ACWR_WINDOW_DAYS);
        java.time.LocalDateTime latest = null;
        for (RunMetricsProjection run : runs) {
            if (run.getEffectiveStartTime() == null) continue;
            LocalDate day = run.getEffectiveStartTime().toLocalDate();
            if (day.isBefore(windowStart) || day.isAfter(end)) continue;
            if (!isHardSession(run, runnerMaxHr)) continue;
            if (latest == null || run.getEffectiveStartTime().isAfter(latest)) {
                latest = run.getEffectiveStartTime();
            }
        }
        if (latest == null) return null;
        long hours = Duration.between(latest, end.plusDays(1).atStartOfDay()).toHours();
        return (int) Math.max(0, hours);
    }

    static boolean isHardSession(RunMetricsProjection run, Integer runnerMaxHr) {
        double km = run.getDistanceKm() != null && run.getDistanceKm() > 0
                ? run.getDistanceKm()
                : (run.getDistanceMeters() != null && run.getDistanceMeters() > 0 ? run.getDistanceMeters() / 1000.0 : 0);
        if (km >= HARD_RUN_MIN_KM) return true;
        if (movingSeconds(run) >= HARD_RUN_MIN_SECONDS) return true;
        Double maxHr = run.getMaxHeartRate();
        return maxHr != null && runnerMaxHr != null && runnerMaxHr > 0 && maxHr / runnerMaxHr >= HARD_RUN_HR_FRACTION;
    }
}
