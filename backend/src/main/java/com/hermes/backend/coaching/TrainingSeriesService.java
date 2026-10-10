package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Fitness, fatigue and form over time, and the weekly effort against the runner's own usual range: both read
 * from the effort score every run already carries (see {@link TrainingMetricsService}), summed per calendar day in the
 * runner's own time zone. Nothing is stored for them: a day's load is a sum of stored rows, so a series cannot
 * drift from the rows it is made of, and one indexed query per request is all it costs.
 *
 * <p>Every query is keyed by the runner, so one runner's rows can never reach another's series. The arithmetic is in
 * {@link FitnessModel} and {@link WeeklyEffortModel}.</p>
 *
 * <p>These numbers are built on the <em>Effort</em> score of each run (time in heart-rate zones, weighted 1 to 5), which
 * is not the load the Load balance chart's acute and chronic lines use. The two stay as they are, side by side and
 * labelled differently, until the owner decides whether to bring them onto one scale.</p>
 */
@Service
public class TrainingSeriesService {

    /** A history shorter than this has not seen enough of the slow average for fitness and form to mean anything. */
    public static final int MIN_HISTORY_DAYS = 14;
    /** How far past today the rest projection reaches. */
    public static final int PROJECTION_DAYS = 14;
    public static final int DEFAULT_DAYS = 180;
    public static final int DEFAULT_WEEKS = 12;
    public static final int MAX_WEEKS = 52;
    /**
     * Load older than this adds under a millionth to the slowest average at any sensible setting, so it is not read.
     * (At 42 days, the weight of a day 730 days back is e^-17.)
     */
    static final int WARMUP_DAYS = 730;
    private static final int CHANGE_DAYS = 7;

    public record Point(LocalDate date, double load, double fitness, double fatigue, double form) {
    }

    public record ProjectedPoint(LocalDate date, double fitness, double fatigue, double form) {
    }

    /** Where the last day of the window stands, and how far each number moved over the week before it. */
    public record Current(LocalDate date, double fitness, double fatigue, double form,
                          double fitnessChange7d, double fatigueChange7d, double formChange7d) {
    }

    /**
     * @param status       {@code none} (no run has an effort yet), {@code building} (the first run is less than
     *                     {@link #MIN_HISTORY_DAYS} days ago, so fitness and form are not shown) or {@code ready}
     * @param historyDays  days from the first run with an effort to today, counting both
     * @param points       one per day from the later of {@code from} and the first run to {@code to}, oldest first
     * @param projection   the days after today if the runner rests, only when the window ends today
     * @param current      the last day of {@code points}; null when there are none
     * @param sources      runs in the window by where their effort came from (HR_ZONES, PERCEIVED, ...)
     * @param pendingRuns  runs of the runner that have no effort yet or whose effort is being recalculated
     */
    public record SeriesResponse(LocalDate from, LocalDate to, LocalDate today, String timeZone, String status,
                                 int historyDays, int minHistoryDays, int fitnessDays, int fatigueDays,
                                 List<Point> points, List<ProjectedPoint> projection, Current current,
                                 Map<String, Long> sources, long runs, long pendingRuns) {
    }

    public record UsualRange(double low, double high, double average) {
    }

    public record WeekRow(LocalDate start, LocalDate end, double total, int runs, boolean complete,
                          UsualRange range, String status) {
    }

    public record WeeklyResponse(LocalDate today, String timeZone, int bandPercent, List<WeekRow> weeks, long pendingRuns) {
    }

    private final ActivityTrainingMetricsRepository metrics;
    private final TrainingZonesService zonesService;
    private final Clock clock;
    private final int fitnessDays;
    private final int fatigueDays;
    private final double band;
    private final int maxDays;

    @Autowired
    public TrainingSeriesService(ActivityTrainingMetricsRepository metrics,
                                 TrainingZonesService zonesService,
                                 @Value("${app.training.fitness-days:42}") int fitnessDays,
                                 @Value("${app.training.fatigue-days:7}") int fatigueDays,
                                 @Value("${app.training.weekly-range-band:0.2}") double band,
                                 @Value("${app.training.series-max-days:400}") int maxDays) {
        this(metrics, zonesService, fitnessDays, fatigueDays, band, maxDays, Clock.systemUTC());
    }

    TrainingSeriesService(ActivityTrainingMetricsRepository metrics, TrainingZonesService zonesService,
                          int fitnessDays, int fatigueDays, double band, int maxDays, Clock clock) {
        if (fitnessDays < 1 || fatigueDays < 1 || fatigueDays >= fitnessDays) {
            throw new IllegalArgumentException("Fatigue must be a faster average than fitness (1 <= fatigue-days < fitness-days).");
        }
        if (!(band > 0 && band < 1)) {
            throw new IllegalArgumentException("The weekly range band is a share between 0 and 1.");
        }
        this.metrics = metrics;
        this.zonesService = zonesService;
        this.fitnessDays = fitnessDays;
        this.fatigueDays = fatigueDays;
        this.band = band;
        this.maxDays = Math.max(1, maxDays);
        this.clock = clock;
    }

    /** The runner's own today: the calendar day it is where they live (UTC when no time zone is set). */
    LocalDate today(Runner runner) {
        return LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
    }

    /**
     * Fitness, fatigue and form for each day from {@code from} to {@code to}.
     *
     * @param from the first day; null for {@link #DEFAULT_DAYS} days up to {@code to}
     * @param to   the last day; null or after today means today
     * @throws IllegalArgumentException when {@code from} is after {@code to} or the window is longer than allowed
     */
    public SeriesResponse series(Runner runner, LocalDate from, LocalDate to) {
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = today(runner);
        LocalDate end = to == null || to.isAfter(today) ? today : to;
        LocalDate start = from == null ? end.minusDays(DEFAULT_DAYS - 1L) : from;
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("The first day must not be after the last.");
        }
        if (ChronoUnit.DAYS.between(start, end) + 1 > maxDays) {
            throw new IllegalArgumentException("Ask for at most " + maxDays + " days at a time.");
        }

        Long runnerId = runner.getId();
        LocalDate first = metrics.firstEffortDay(runnerId);
        int historyDays = first == null || first.isAfter(today) ? 0 : (int) ChronoUnit.DAYS.between(first, today) + 1;
        String status = first == null ? "none" : historyDays < MIN_HISTORY_DAYS ? "building" : "ready";

        List<Point> points = List.of();
        List<ProjectedPoint> projection = List.of();
        Current current = null;
        if (first != null && !first.isAfter(end)) {
            LocalDate warmFrom = later(first, start.minusDays(WARMUP_DAYS));
            Map<LocalDate, Double> loads = loadByDay(metrics.dailyEffort(runnerId, warmFrom, end));
            List<FitnessModel.Day> days = FitnessModel.run(loads, warmFrom, end, fitnessDays, fatigueDays);
            LocalDate shownFrom = later(first, start);
            points = days.stream().filter(day -> !day.date().isBefore(shownFrom)).map(TrainingSeriesService::point).toList();
            FitnessModel.Day last = days.get(days.size() - 1);
            current = current(days, last);
            if (end.equals(today)) {
                projection = FitnessModel.restProjection(last, PROJECTION_DAYS, fitnessDays, fatigueDays).stream()
                        .map(day -> new ProjectedPoint(day.date(), round(day.fitness()), round(day.fatigue()), round(day.form())))
                        .toList();
            }
        }

        Map<String, Long> sources = new LinkedHashMap<>();
        long runs = 0;
        for (Object[] row : metrics.effortSourceCounts(runnerId, start, end)) {
            long count = ((Number) row[1]).longValue();
            sources.put(row[0] == null ? "UNKNOWN" : (String) row[0], count);
            runs += count;
        }
        return new SeriesResponse(start, end, today, zone.getId(), status, historyDays, MIN_HISTORY_DAYS, fitnessDays,
                fatigueDays, points, projection, current, sources, runs, pendingRuns(runner));
    }

    /**
     * The last {@code weeks} weeks (this one included), each against the range of the three weeks before it.
     *
     * @param weeks how many weeks, 1 to {@link #MAX_WEEKS}; null for {@link #DEFAULT_WEEKS}
     */
    public WeeklyResponse weekly(Runner runner, Integer weeks) {
        int count = weeks == null ? DEFAULT_WEEKS : weeks;
        if (count < 1 || count > MAX_WEEKS) {
            throw new IllegalArgumentException("Ask for 1 to " + MAX_WEEKS + " weeks.");
        }
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = today(runner);
        Long runnerId = runner.getId();
        LocalDate first = metrics.firstEffortDay(runnerId);

        List<WeekRow> rows = List.of();
        if (first != null) {
            // Three weeks more than are shown, so that the oldest week shown has the weeks its own range is made of.
            LocalDate readFrom = WeeklyEffortModel.weekStart(today).minusWeeks(count - 1L + 3);
            Map<LocalDate, Double> effort = new HashMap<>();
            Map<LocalDate, Integer> runs = new HashMap<>();
            for (Object[] row : metrics.dailyEffort(runnerId, readFrom, today)) {
                LocalDate day = (LocalDate) row[0];
                effort.put(day, ((Number) row[1]).doubleValue());
                runs.put(day, ((Number) row[2]).intValue());
            }
            rows = WeeklyEffortModel.weeks(effort, runs, today, first, count, band).stream().map(TrainingSeriesService::row).toList();
        }
        return new WeeklyResponse(today, zone.getId(), (int) Math.round(band * 100), rows, pendingRuns(runner));
    }

    /**
     * Runs the series cannot count yet: a run with no effort row (it has not been analysed) or whose row is out of
     * date (the zones or the model changed and it is being worked out again). Both make the numbers lower or
     * different from what they will be, which is why the answer says so.
     */
    long pendingRuns(Runner runner) {
        HeartRateZones zones = zonesService.resolve(runner).zones();
        long missing = metrics.countRunsWithoutMetrics(runner.getId(), ActivityType.RUN);
        long outOfDate = metrics.countOutOfDate(runner.getId(), TrainingMetricsService.MODEL_VERSION, zones.maxHeartRate(),
                zones.boundary(0), zones.boundary(1), zones.boundary(2), zones.boundary(3));
        return missing + outOfDate;
    }

    private Current current(List<FitnessModel.Day> days, FitnessModel.Day last) {
        FitnessModel.Day before = days.size() > CHANGE_DAYS ? days.get(days.size() - 1 - CHANGE_DAYS) : null;
        // Before the first day of the model every average was zero.
        double fitnessBefore = before == null ? 0 : before.fitness();
        double fatigueBefore = before == null ? 0 : before.fatigue();
        double formBefore = before == null ? 0 : before.form();
        return new Current(last.date(), round(last.fitness()), round(last.fatigue()), round(last.form()),
                round(last.fitness() - fitnessBefore), round(last.fatigue() - fatigueBefore), round(last.form() - formBefore));
    }

    private static Point point(FitnessModel.Day day) {
        return new Point(day.date(), round(day.load()), round(day.fitness()), round(day.fatigue()), round(day.form()));
    }

    private static WeekRow row(WeeklyEffortModel.Week week) {
        WeeklyEffortModel.Range range = week.range();
        return new WeekRow(week.start(), week.end(), round(week.total()), week.runs(), week.complete(),
                range == null ? null : new UsualRange(round(range.low()), round(range.high()), round(range.average())),
                week.status().code());
    }

    private static Map<LocalDate, Double> loadByDay(List<Object[]> rows) {
        Map<LocalDate, Double> loads = new HashMap<>();
        for (Object[] row : rows) {
            loads.put((LocalDate) row[0], ((Number) row[1]).doubleValue());
        }
        return loads;
    }

    private static LocalDate later(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }

    private static double round(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
