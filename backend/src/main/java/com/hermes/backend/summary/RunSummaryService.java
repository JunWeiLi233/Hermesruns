package com.hermes.backend.summary;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.PaceProfileResponse;
import com.hermes.backend.activity.RunStreamInsights;
import com.hermes.backend.coaching.ActivityTrainingMetrics;
import com.hermes.backend.coaching.ActivityTrainingMetricsRepository;
import com.hermes.backend.coaching.TrainingLogRepository;
import com.hermes.backend.coaching.TrainingMetricsService;
import com.hermes.backend.coaching.TrainingSeriesService;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Says what can be said about one run (see docs/README-ANALYSIS.md, "Run Summary"): it gathers what the rules look at, from
 * what the run page's other cards already read, and hands it to {@link RunSummaryRules}. Only the runner's own runs are
 * read, and nothing is stored: the same run says the same until its numbers, or the runs around it, change.
 */
@Service
public class RunSummaryService {

    private final TrainingMetricsService metrics;
    private final TrainingLogRepository rows;
    private final RunStreamInsights streams;
    private final TrainingSeriesService series;
    private final ActivityTrainingMetricsRepository metricRows;

    public RunSummaryService(TrainingMetricsService metrics, TrainingLogRepository rows, RunStreamInsights streams,
                             TrainingSeriesService series, ActivityTrainingMetricsRepository metricRows) {
        this.metrics = metrics;
        this.rows = rows;
        this.streams = streams;
        this.series = series;
        this.metricRows = metricRows;
    }

    /** The summary of one of the runner's runs; empty when the runner has no such run. */
    public Optional<RunSummary> summarise(Runner runner, Long activityId) {
        return metrics.freshMetrics(runner, activityId).map(found -> {
            Activity run = found.activity();
            ActivityTrainingMetrics effort = found.metrics();
            LocalDate day = effort.getLocalDate();
            if (run.getDistanceKm() < SummaryThresholds.MIN_KM || run.getMovingTimeSeconds() < SummaryThresholds.MIN_MOVING_SECONDS) {
                return RunSummary.none(run.getId(), day, RunSummary.TOO_SHORT);
            }
            RunStreamInsights.Readings stream = streams.read(run);
            SummaryInputs inputs = new SummaryInputs(
                    new SummaryInputs.Run(run.getId(), run.getRunType(), day, run.getDistanceKm(), run.getMovingTimeSeconds(),
                            effort.getEffortScore(), run.getTotalElevationGain(), zones(effort)),
                    earlierRuns(runner, run, day),
                    splits(stream.paceProfile()),
                    stream.drift() == null ? null
                            : new SummaryInputs.Drift(stream.drift().percent(), stream.drift().firstHalfHeartRate(), stream.drift().secondHalfHeartRate()),
                    formGoingIn(runner, day));
            return RunSummary.ready(run.getId(), day, RunSummaryRules.evaluate(inputs));
        });
    }

    /** Seconds in each zone, or null when the run has no heart-rate stream to have spent any in. */
    static int[] zones(ActivityTrainingMetrics effort) {
        return effort.getHrCoveredSeconds() > 0 ? effort.zoneSeconds() : null;
    }

    /** The runner's runs on the days before this run's, as far back as any rule looks, each on the runner's own calendar. */
    private List<SummaryInputs.RecentRun> earlierRuns(Runner runner, Activity run, LocalDate day) {
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate from = day.minusDays(SummaryThresholds.EFFORT_DAYS);
        // A day more at each end: a run's recorded time can sit a day either side of the runner's calendar (see the training log).
        List<TrainingLogRepository.LogRunRow> found = rows.findRows(runner.getId(), ActivityType.RUN,
                from.minusDays(1).atStartOfDay(), day.plusDays(2).atStartOfDay());
        List<SummaryInputs.RecentRun> earlier = new ArrayList<>();
        for (TrainingLogRepository.LogRunRow row : found) {
            if (row.getId().equals(run.getId())) {
                continue;
            }
            LocalDate placed = ActivityLocalDates.placed(row.getLocalDate(), row.getStartTime(), row.getCreatedAt(), row.getStravaApiSourced(), zone);
            if (placed.isBefore(from) || !placed.isBefore(day)) {
                continue;
            }
            earlier.add(new SummaryInputs.RecentRun(row.getId(), placed, row.getRunType(), kilometres(row), movingSeconds(row), row.getEffortScore()));
        }
        return earlier;
    }

    private static double kilometres(TrainingLogRepository.LogRunRow row) {
        if (row.getDistanceKm() != null && row.getDistanceKm() > 0) {
            return row.getDistanceKm();
        }
        return row.getDistanceMeters() != null && row.getDistanceMeters() > 0 ? row.getDistanceMeters() / 1000.0 : 0.0;
    }

    private static int movingSeconds(TrainingLogRepository.LogRunRow row) {
        if (row.getMovingTimeSeconds() != null && row.getMovingTimeSeconds() > 0) {
            return row.getMovingTimeSeconds();
        }
        return row.getDurationSeconds() != null && row.getDurationSeconds() > 0 ? row.getDurationSeconds().intValue() : 0;
    }

    /**
     * The full kilometres of the pace profile, in grade-adjusted pace when every one of them has it (the run had elevation
     * to adjust for) and in the pace on the clock otherwise; null when the run has no usable stream.
     */
    static SummaryInputs.Splits splits(PaceProfileResponse profile) {
        if (profile == null || !profile.hasStream()) {
            return null;
        }
        List<PaceProfileResponse.Split> full = profile.splits().stream()
                .filter(split -> !split.partial() && split.paceSecPerKm() != null)
                .toList();
        boolean adjusted = profile.hasElevation() && !full.isEmpty() && full.stream().allMatch(split -> split.gapSecPerKm() != null);
        List<Double> paces = full.stream().map(split -> adjusted ? split.gapSecPerKm() : split.paceSecPerKm()).toList();
        PaceProfileResponse.Summary summary = profile.summary();
        return new SummaryInputs.Splits(paces, adjusted, summary == null ? null : summary.paceSecPerKm(), summary == null ? null : summary.gapSecPerKm());
    }

    /**
     * Fitness, fatigue and form at the end of the day before the run, when the runner had at least two weeks of effort
     * behind them by then; otherwise null, because the averages have not seen enough to say anything.
     */
    private SummaryInputs.Form formGoingIn(Runner runner, LocalDate day) {
        LocalDate before = day.minusDays(1);
        LocalDate first = metricRows.firstEffortDay(runner.getId());
        if (first == null || ChronoUnit.DAYS.between(first, before) + 1 < TrainingSeriesService.MIN_HISTORY_DAYS) {
            return null;
        }
        TrainingSeriesService.SeriesResponse response = series.series(runner, before, before);
        if (response.points().isEmpty()) {
            return null;
        }
        TrainingSeriesService.Point point = response.points().get(response.points().size() - 1);
        return new SummaryInputs.Form(point.date(), point.fitness(), point.fatigue(), point.form());
    }
}
