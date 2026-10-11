package com.hermes.backend.activity;

import com.hermes.backend.activity.BestEffortCalculator.Effort;
import com.hermes.backend.activity.BestEffortDistances.Distance;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The best efforts of runs: working them out and storing them (inside the transaction of {@link RunRecordsCoordinator}),
 * and reading them back with their rank for the run page and the records analysis.
 *
 * <p>A run's efforts are replaced whenever it is analysed again, except for what the runner decided: a typed chip time
 * and a hidden effort stay.</p>
 *
 * <p>Where a run has no stream, or the stream is too short for a distance the run came close to (within 10%), the
 * effort is the run's average pace carried over to the distance and is marked {@code estimated}. That is the whole-run
 * fallback the profile's personal records have always had. It applies from 1 km up: a short effort carried over from an
 * average pace would say nothing.</p>
 */
@Service
public class BestEffortService {

    /**
     * Bump when the way efforts or routes are worked out changes, so every run is analysed again (see
     * {@code Activity.recordsVersion}).
     */
    public static final int MODEL_VERSION = 1;

    /** Distances shorter than this are never estimated from an average pace. */
    static final double MIN_ESTIMATE_METERS = 1000.0;
    /** A run within this share of a distance gets an estimate for it. */
    static final double ESTIMATE_SHARE = 0.9;
    /** The most a typed chip time may differ from a speed a runner can hold: not faster than 1:40 per km, not slower than 30:00. */
    static final double MAX_TYPED_SPEED_MPS = 10.0;
    static final double MIN_TYPED_SPEED_MPS = 1000.0 / 1800.0;

    static final int LIFETIME_RANKS = 3;
    static final int ANNUAL_RANKS = 10;

    private final ActivityBestEffortRepository efforts;
    private final ActivityRepository activities;
    private final TtlCacheStore cacheStore;

    public BestEffortService(ActivityBestEffortRepository efforts, ActivityRepository activities, TtlCacheStore cacheStore) {
        this.efforts = efforts;
        this.activities = activities;
        this.cacheStore = cacheStore;
    }

    // ----- the views the screens read -----

    /**
     * One best effort.
     *
     * @param elapsedSeconds   what was measured (or estimated)
     * @param effectiveSeconds what counts: the typed time when there is one
     * @param rank             1 for the runner's best at this distance, 2 for the next, and so on; null for a hidden effort
     */
    public record EffortView(String distanceKey, double distanceMeters, double elapsedSeconds, double effectiveSeconds,
                             double paceSecPerKm, boolean edited, boolean estimated, boolean hidden, Integer rank,
                             Integer startOffsetSeconds, Integer endOffsetSeconds) {
    }

    /** @param complete false while some of the runner's runs have not been analysed yet, so ranks may still change */
    public record RunEfforts(boolean complete, List<EffortView> efforts) {
    }

    /** One line of a ranking. */
    public record RankedEffort(int rank, Long activityId, String name, LocalDate date, double effectiveSeconds,
                               double paceSecPerKm, boolean edited, boolean estimated) {
    }

    public record YearBest(int year, double bestSeconds, int count) {
    }

    public record DistanceSummary(String key, double meters, long count, double bestSeconds) {
    }

    /**
     * The runner's best efforts at one distance.
     *
     * @param distances the distances the runner has efforts for, with how many and the best time of each
     * @param key       the distance the lists are for, or null when the runner has no efforts
     * @param years     the years with an effort at this distance, oldest first
     * @param year      the year {@code annual} is for
     * @param lifetime  the three best ever
     * @param annual    the ten best of {@code year}
     * @param trend     the best time of every year
     */
    public record Analysis(boolean complete, List<DistanceSummary> distances, String key, double meters,
                           List<Integer> years, Integer year, List<RankedEffort> lifetime, List<RankedEffort> annual,
                           List<YearBest> trend) {
    }

    // ----- writing, inside the coordinator's transaction -----

    /**
     * Replaces the efforts of one run with what its stream (or its average pace) says, and keeps what the runner decided.
     *
     * @param stream the run's tidied stream, or null when it has none that can be used
     */
    void replaceFor(Activity activity, Runner runner, RunStream stream) {
        LocalDate day = ActivityLocalDates.of(activity, runner);
        Map<String, Found> found = new LinkedHashMap<>();
        for (Effort effort : BestEffortCalculator.compute(stream, BestEffortDistances.ALL)) {
            found.put(effort.key(), new Found(effort.distanceMeters(), effort.elapsedSeconds(),
                    effort.startOffsetSeconds(), effort.endOffsetSeconds(), false));
        }
        addEstimates(activity, found);

        Map<String, ActivityBestEffort> existing = new LinkedHashMap<>();
        for (ActivityBestEffort row : efforts.findByActivityIdAndRunnerIdOrderByDistanceMetersAsc(activity.getId(), runner.getId())) {
            existing.put(row.getDistanceKey(), row);
        }
        for (Map.Entry<String, Found> entry : found.entrySet()) {
            Found measured = entry.getValue();
            ActivityBestEffort row = existing.remove(entry.getKey());
            if (row == null) {
                row = new ActivityBestEffort(activity, runner, entry.getKey(), measured.meters());
            }
            row.setMeasured(measured.elapsedSeconds(), measured.startOffset(), measured.endOffset(), measured.estimated(),
                    day, MODEL_VERSION);
            efforts.save(row);
        }
        for (ActivityBestEffort stale : existing.values()) {
            if (stale.getEditedElapsedSeconds() == null && !stale.isHidden()) {
                efforts.delete(stale);
            }
        }
        evictPersonalRecords(runner.getId());
    }

    /** Removes the efforts of an activity that is not a run. */
    void clearFor(Activity activity, Runner runner) {
        efforts.deleteByActivityIds(List.of(activity.getId()));
        evictPersonalRecords(runner.getId());
    }

    private record Found(double meters, double elapsedSeconds, Integer startOffset, Integer endOffset, boolean estimated) {
    }

    private static void addEstimates(Activity activity, Map<String, Found> found) {
        double runMeters = runMeters(activity);
        int moving = movingSeconds(activity);
        if (runMeters <= 0 || moving <= 0) {
            return;
        }
        for (Distance distance : BestEffortDistances.ALL) {
            if (distance.meters() < MIN_ESTIMATE_METERS || found.containsKey(distance.key())
                    || runMeters < ESTIMATE_SHARE * distance.meters()) {
                continue;
            }
            double elapsed = Math.round(moving / runMeters * distance.meters() * 10.0) / 10.0;
            if (elapsed > 0 && distance.meters() / elapsed <= BestEffortCalculator.FASTEST_PLAUSIBLE_SPEED_MPS) {
                found.put(distance.key(), new Found(distance.meters(), elapsed, null, null, true));
            }
        }
    }

    static double runMeters(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm() * 1000.0;
        }
        return activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0 ? activity.getDistanceMeters() : 0;
    }

    static int movingSeconds(Activity activity) {
        if (activity.getMovingTimeSeconds() > 0) {
            return activity.getMovingTimeSeconds();
        }
        return activity.getDurationSeconds() != null && activity.getDurationSeconds() > 0 ? activity.getDurationSeconds().intValue() : 0;
    }

    private void evictPersonalRecords(Long runnerId) {
        ActivityCaches.evictPersonalRecords(cacheStore, runnerId);
    }

    // ----- reading -----

    /** The efforts of one of the runner's runs with their ranks; empty when it is not the runner's run. */
    @Transactional(readOnly = true)
    public Optional<List<EffortView>> effortsOf(Runner runner, Long activityId) {
        if (activities.findByIdAndRunner(activityId, runner).isEmpty()) {
            return Optional.empty();
        }
        List<EffortView> views = new ArrayList<>();
        for (ActivityBestEffort row : efforts.findByActivityIdAndRunnerIdOrderByDistanceMetersAsc(activityId, runner.getId())) {
            views.add(view(row, runner.getId()));
        }
        return Optional.of(views);
    }

    private EffortView view(ActivityBestEffort row, Long runnerId) {
        Integer rank = row.isHidden() ? null : (int) efforts.countAhead(runnerId, row.getDistanceKey(),
                row.getEffectiveSeconds(), row.getLocalDate(), row.getActivity().getId()) + 1;
        return new EffortView(row.getDistanceKey(), row.getDistanceMeters(), row.getElapsedSeconds(), row.getEffectiveSeconds(),
                paceOf(row.getEffectiveSeconds(), row.getDistanceMeters()), row.getEditedElapsedSeconds() != null,
                row.isEstimated(), row.isHidden(), rank, row.getStartOffsetSeconds(), row.getEndOffsetSeconds());
    }

    static double paceOf(double seconds, double meters) {
        return Math.round(seconds / (meters / 1000.0) * 10.0) / 10.0;
    }

    /** What the runner may change about one effort. A field left null is left alone, except {@code clearEdit}. */
    public record Change(Integer elapsedSeconds, boolean clearEdit, Boolean hidden) {
    }

    /** Why a change was refused. */
    public static final class InvalidChange extends RuntimeException {
        InvalidChange(String message) {
            super(message);
        }
    }

    /**
     * Types a chip time for an effort, takes it back, or hides or shows the effort.
     *
     * @return the effort as it is now; empty when the runner has no such run, or the run has no effort at that distance
     * @throws InvalidChange when the typed time is not one a runner could run
     */
    @Transactional
    public Optional<EffortView> change(Runner runner, Long activityId, String distanceKey, Change change) {
        if (activities.findByIdAndRunner(activityId, runner).isEmpty()) {
            return Optional.empty();
        }
        Optional<ActivityBestEffort> found = efforts.findByActivityIdAndRunnerIdAndDistanceKey(activityId, runner.getId(), distanceKey);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        ActivityBestEffort row = found.get();
        if (change.elapsedSeconds() != null) {
            int seconds = change.elapsedSeconds();
            double speed = seconds > 0 ? row.getDistanceMeters() / seconds : Double.POSITIVE_INFINITY;
            if (seconds <= 0 || speed > MAX_TYPED_SPEED_MPS || speed < MIN_TYPED_SPEED_MPS) {
                throw new InvalidChange("That time is not one a runner could run over this distance.");
            }
            row.setEditedElapsedSeconds(seconds);
        } else if (change.clearEdit()) {
            row.setEditedElapsedSeconds(null);
        }
        if (change.hidden() != null) {
            row.setHidden(change.hidden());
        }
        efforts.save(row);
        evictPersonalRecords(runner.getId());
        return Optional.of(view(row, runner.getId()));
    }

    /**
     * The runner's efforts at one distance: the three best ever, the ten best of a year, and the best of every year.
     *
     * @param distanceKey the distance, or null for the first the runner has (the 5 km when they have it)
     * @param year        the year for the annual list, or null for the latest year with an effort
     */
    @Transactional(readOnly = true)
    public Analysis analysis(Runner runner, String distanceKey, Integer year, boolean complete) {
        Long runnerId = runner.getId();
        List<DistanceSummary> distances = new ArrayList<>();
        Map<String, Object[]> summaryByKey = new LinkedHashMap<>();
        for (Object[] row : efforts.summaryByDistance(runnerId)) {
            summaryByKey.put((String) row[0], row);
        }
        for (Distance distance : BestEffortDistances.ALL) {
            Object[] row = summaryByKey.get(distance.key());
            if (row != null) {
                distances.add(new DistanceSummary(distance.key(), distance.meters(), ((Number) row[1]).longValue(),
                        ((Number) row[2]).doubleValue()));
            }
        }
        String key = chooseKey(distances, distanceKey);
        if (key == null) {
            return new Analysis(complete, distances, null, 0.0, List.of(), null, List.of(), List.of(), List.of());
        }
        double meters = BestEffortDistances.byKey(key).orElseThrow().meters();

        // Per year, from the database: a long history is never loaded to cut three lists and a trend out of it.
        List<Integer> years = new ArrayList<>();
        List<YearBest> trend = new ArrayList<>();
        for (Object[] row : efforts.summaryByYear(runnerId, key)) {
            int rowYear = ((Number) row[0]).intValue();
            years.add(rowYear);
            trend.add(new YearBest(rowYear, ((Number) row[2]).doubleValue(), ((Number) row[1]).intValue()));
        }
        Integer chosenYear = year != null ? year : (years.isEmpty() ? null : years.get(years.size() - 1));

        List<RankedEffort> lifetime = ranked(efforts.findRanked(runnerId, key, PageRequest.of(0, LIFETIME_RANKS)));
        List<RankedEffort> annual = List.of();
        if (chosenYear != null && years.contains(chosenYear)) {
            annual = ranked(efforts.findRankedBetween(runnerId, key, LocalDate.of(chosenYear, 1, 1),
                    LocalDate.of(chosenYear + 1, 1, 1), PageRequest.of(0, ANNUAL_RANKS)));
        }
        return new Analysis(complete, distances, key, meters, years, chosenYear, lifetime, annual, trend);
    }

    private static String chooseKey(List<DistanceSummary> distances, String requested) {
        if (distances.isEmpty()) {
            return null;
        }
        if (requested != null && distances.stream().anyMatch(summary -> summary.key().equals(requested))) {
            return requested;
        }
        return distances.stream().anyMatch(summary -> summary.key().equals("5km")) ? "5km" : distances.get(0).key();
    }

    private static List<RankedEffort> ranked(List<ActivityBestEffort> rows) {
        List<RankedEffort> out = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            ActivityBestEffort row = rows.get(i);
            out.add(new RankedEffort(i + 1, row.getActivity().getId(), row.getActivity().getName(), row.getLocalDate(),
                    row.getEffectiveSeconds(), paceOf(row.getEffectiveSeconds(), row.getDistanceMeters()),
                    row.getEditedElapsedSeconds() != null, row.isEstimated()));
        }
        return out;
    }
}
