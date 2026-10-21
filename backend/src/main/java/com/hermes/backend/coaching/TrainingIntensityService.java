package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * How the runner's running time was spread over their heart-rate zones, week by week (Monday to Sunday on the runner's
 * own calendar), and what name that spread has. Read from the time in each zone that every run already carries (see
 * {@link TrainingMetricsService}): nothing is stored for it, so the weeks cannot drift from the runs they are made of.
 *
 * <p>Only runs with a heart-rate stream have time in zones. A run without one is counted as a run but adds no time, and
 * the answer says how many runs that is, so a week with one watch run and three phone runs is not read as a week with
 * a quarter of its time. The arithmetic of the shares and the name is in {@link IntensityModel}.</p>
 */
@Service
public class TrainingIntensityService {

    public static final int DEFAULT_WEEKS = 12;
    public static final int MAX_WEEKS = 52;

    /** The shares of the heart-rate time spent in the low, moderate and high bands, each between 0 and 1. */
    public record Shares(double low, double moderate, double high) {
    }

    /**
     * @param runsWithHeartRate runs of the week that have time in zones
     * @param zoneSeconds       seconds in zones 1 to 5 over all the week's runs
     * @param coveredSeconds    the sum of {@code zoneSeconds}: the time the shares are shares of
     */
    public record WeekRow(LocalDate start, LocalDate end, boolean complete, int runs, int runsWithHeartRate,
                          long[] zoneSeconds, long coveredSeconds) {
    }

    /**
     * @param shares            null when no run of the window has time in zones
     * @param polarizationIndex null when the index is not defined for these shares
     * @param pattern           {@code insufficient}, {@code polarized}, {@code pyramidal}, {@code threshold}, {@code high}
     *                          or {@code mixed} (see {@link IntensityModel.Pattern})
     */
    public record Summary(int runs, int runsWithHeartRate, long coveredSeconds, long[] zoneSeconds, Shares shares,
                          Double polarizationIndex, String pattern) {
    }

    /**
     * @param lowZones    zones 1 to this number are the low band; the next zone is the moderate band and the rest the high band
     * @param weeks       the weeks asked for, oldest first, from the later of the first week asked for and the runner's first run
     * @param summary     all of those weeks together
     * @param pendingRuns runs the weeks cannot count yet because their zones are not worked out
     */
    public record IntensityResponse(LocalDate today, String timeZone, int lowZones, int minRuns, long minCoveredSeconds,
                                    List<WeekRow> weeks, Summary summary, long pendingRuns) {
    }

    private final ActivityTrainingMetricsRepository metrics;
    private final TrainingSeriesService series;

    @Autowired
    public TrainingIntensityService(ActivityTrainingMetricsRepository metrics, TrainingSeriesService series) {
        this.metrics = metrics;
        this.series = series;
    }

    /**
     * The last {@code weeks} weeks (this one included).
     *
     * @param weeks how many weeks, 1 to {@link #MAX_WEEKS}; null for {@link #DEFAULT_WEEKS}
     * @throws IllegalArgumentException when {@code weeks} is out of range
     */
    public IntensityResponse intensity(Runner runner, Integer weeks) {
        int count = weeks == null ? DEFAULT_WEEKS : weeks;
        if (count < 1 || count > MAX_WEEKS) {
            throw new IllegalArgumentException("Ask for 1 to " + MAX_WEEKS + " weeks.");
        }
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = series.today(runner);
        Long runnerId = runner.getId();
        LocalDate first = metrics.firstEffortDay(runnerId);

        List<WeekRow> rows = new ArrayList<>();
        long[] total = new long[HeartRateZones.ZONE_COUNT];
        int runs = 0;
        int runsWithHeartRate = 0;
        if (first != null) {
            LocalDate currentStart = WeeklyEffortModel.weekStart(today);
            Map<LocalDate, long[]> byWeek = new HashMap<>();
            for (Object[] row : metrics.dailyZoneSeconds(runnerId, currentStart.minusWeeks(count - 1L), today)) {
                // [runs, runs with a heart rate, zone 1 ... zone 5]
                long[] week = byWeek.computeIfAbsent(WeeklyEffortModel.weekStart((LocalDate) row[0]), key -> new long[2 + HeartRateZones.ZONE_COUNT]);
                for (int i = 0; i < week.length; i++) {
                    week[i] += ((Number) row[1 + i]).longValue();
                }
            }
            for (int back = count - 1; back >= 0; back--) {
                LocalDate start = currentStart.minusWeeks(back);
                LocalDate end = start.plusDays(6);
                if (end.isBefore(first)) {
                    continue;
                }
                long[] week = byWeek.getOrDefault(start, new long[2 + HeartRateZones.ZONE_COUNT]);
                long[] zoneSeconds = new long[HeartRateZones.ZONE_COUNT];
                long covered = 0;
                for (int zoneIndex = 0; zoneIndex < zoneSeconds.length; zoneIndex++) {
                    zoneSeconds[zoneIndex] = week[2 + zoneIndex];
                    covered += zoneSeconds[zoneIndex];
                    total[zoneIndex] += zoneSeconds[zoneIndex];
                }
                runs += (int) week[0];
                runsWithHeartRate += (int) week[1];
                rows.add(new WeekRow(start, end, end.isBefore(today), (int) week[0], (int) week[1], zoneSeconds, covered));
            }
        }
        return new IntensityResponse(today, zone.getId(), IntensityModel.LOW_ZONE_COUNT, IntensityModel.MIN_RUNS,
                IntensityModel.MIN_COVERED_SECONDS, rows, summary(total, runs, runsWithHeartRate), series.pendingRuns(runner));
    }

    private static Summary summary(long[] zoneSeconds, int runs, int runsWithHeartRate) {
        IntensityModel.Reading reading = IntensityModel.read(zoneSeconds, runsWithHeartRate);
        long covered = 0;
        for (long seconds : zoneSeconds) {
            covered += seconds;
        }
        IntensityModel.Shares shares = reading.shares();
        return new Summary(runs, runsWithHeartRate, covered, zoneSeconds,
                shares == null ? null : new Shares(round4(shares.low()), round4(shares.moderate()), round4(shares.high())),
                reading.polarizationIndex() == null ? null : Math.round(reading.polarizationIndex() * 100.0) / 100.0,
                reading.pattern().code());
    }

    private static double round4(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
