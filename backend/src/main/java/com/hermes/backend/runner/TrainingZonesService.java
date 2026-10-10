package com.hermes.backend.runner;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunMetricsProjection;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The heart-rate zones a runner trains with, and how they are set.
 *
 * <p>The max heart rate is the one on the runner's profile (the coach writes it too), or 190 when there
 * is none. The boundaries are the default percentages of it, unless the runner set their own. Nothing is
 * guessed behind the runner's back: when their recorded runs suggest a different max heart rate, that is
 * offered as a suggestion and takes effect only when they accept it.</p>
 */
@Service
public class TrainingZonesService {

    /** A suggestion needs this many runs with a recorded max heart rate in the last year. */
    static final int MIN_RUNS_FOR_SUGGESTION = 20;
    /** Share of the runs' peak heart rates the suggestion sits at, so one spiking sensor cannot set it. */
    static final double SUGGESTION_PERCENTILE = 0.95;
    static final int SUGGESTION_WINDOW_DAYS = 365;
    /** Peak heart rates below this are not real peaks (a short easy run, a strap that slipped). */
    static final int MIN_PLAUSIBLE_PEAK = 140;

    /** The zones in force and where each part of them came from. */
    public record ResolvedZones(HeartRateZones zones, String maxHeartRateSource, String boundarySource) {
    }

    /** A max heart rate the runner's own runs point to. */
    public record MaxHeartRateSuggestion(int bpm, int basedOnRuns) {
    }

    /**
     * What a runner asks to change. A null field leaves that part as it is.
     *
     * @param maxHeartRateBpm          a new max heart rate, 120 to 230
     * @param clearMaxHeartRate        go back to the default max heart rate
     * @param heartRateBoundaries      four boundaries to use from now on, in place of the automatic ones
     * @param resetHeartRateBoundaries go back to the automatic boundaries
     */
    public record Update(Integer maxHeartRateBpm, boolean clearMaxHeartRate, int[] heartRateBoundaries,
                         boolean resetHeartRateBoundaries) {
    }

    /** The zones after an update, and whether they differ from before (so history needs recomputing). */
    public record UpdateResult(ResolvedZones zones, boolean changed) {
    }

    private final RunnerRepository runners;
    private final RunnerTrainingZonesRepository zoneRows;
    private final ActivityRepository activities;
    private final ApplicationEventPublisher events;
    private final int[] percentages;

    public TrainingZonesService(RunnerRepository runners,
                                RunnerTrainingZonesRepository zoneRows,
                                ActivityRepository activities,
                                ApplicationEventPublisher events,
                                @Value("${app.training.hr-zone-percentages:60,70,80,90}") String percentages) {
        this.runners = runners;
        this.zoneRows = zoneRows;
        this.activities = activities;
        this.events = events;
        this.percentages = parsePercentages(percentages);
    }

    static int[] parsePercentages(String configured) {
        try {
            int[] parsed = Arrays.stream(configured.split(",")).map(String::trim).mapToInt(Integer::parseInt).toArray();
            if (parsed.length == HeartRateZones.BOUNDARY_COUNT && isStrictlyIncreasing(parsed) && parsed[0] > 0 && parsed[3] < 100) {
                return parsed;
            }
        } catch (NumberFormatException ignored) {
            // fall through to the defaults
        }
        return new int[] {60, 70, 80, 90};
    }

    private static boolean isStrictlyIncreasing(int[] values) {
        for (int i = 1; i < values.length; i++) {
            if (values[i] <= values[i - 1]) {
                return false;
            }
        }
        return true;
    }

    /** The zones in force for this runner right now. */
    @Transactional(readOnly = true)
    public ResolvedZones resolve(Runner runner) {
        Integer stored = runner.getMaxHeartRateBpm();
        boolean hasMax = stored != null && stored >= HeartRateZones.MIN_MAX_HEART_RATE && stored <= HeartRateZones.MAX_MAX_HEART_RATE;
        int maxHeartRate = hasMax ? stored : HeartRateZones.DEFAULT_MAX_HEART_RATE;
        String maxSource = hasMax ? HeartRateZones.MAX_SOURCE_PROFILE : HeartRateZones.MAX_SOURCE_DEFAULT;

        Optional<RunnerTrainingZones> row = runner.getId() == null ? Optional.empty() : zoneRows.findByRunner(runner);
        if (row.isPresent() && row.get().isManual()) {
            int[] manual = row.get().manualBoundaries();
            if (HeartRateZones.validate(manual) == null) {
                return new ResolvedZones(new HeartRateZones(maxHeartRate, manual), maxSource, HeartRateZones.SOURCE_MANUAL);
            }
        }
        return new ResolvedZones(HeartRateZones.defaults(maxHeartRate, percentages), maxSource, HeartRateZones.SOURCE_AUTO);
    }

    /** The default boundaries for a max heart rate, for the settings screen to show beside custom ones. */
    public int[] defaultBoundaries(int maxHeartRate) {
        return HeartRateZones.defaults(maxHeartRate, percentages).boundaries();
    }

    /**
     * A max heart rate suggested by the runner's runs in the last year: the 95th percentile of their peak
     * heart rates, once there are enough runs. Empty when there is not enough to go on.
     */
    @Transactional(readOnly = true)
    public Optional<MaxHeartRateSuggestion> suggestMaxHeartRate(Runner runner) {
        LocalDateTime now = LocalDateTime.now();
        List<RunMetricsProjection> runs = activities.findRunMetricsBetween(
                runner, ActivityType.RUN, now.minusDays(SUGGESTION_WINDOW_DAYS), now.plusDays(1));
        double[] peaks = runs.stream()
                .map(RunMetricsProjection::getMaxHeartRate)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .filter(peak -> peak >= MIN_PLAUSIBLE_PEAK && peak <= HeartRateZones.MAX_MAX_HEART_RATE)
                .sorted()
                .toArray();
        if (peaks.length < MIN_RUNS_FOR_SUGGESTION) {
            return Optional.empty();
        }
        int rank = (int) Math.ceil(SUGGESTION_PERCENTILE * peaks.length) - 1;
        int bpm = (int) Math.round(peaks[Math.max(0, Math.min(rank, peaks.length - 1))]);
        return Optional.of(new MaxHeartRateSuggestion(bpm, peaks.length));
    }

    /**
     * Applies a change. Throws {@link IllegalArgumentException} with a message fit to show the runner when
     * the request is not acceptable, and changes nothing in that case. When the resulting zones differ from
     * the ones before, {@link RunnerZonesChangedEvent} is published after the change is saved.
     */
    @Transactional
    public UpdateResult update(Runner runner, Update update) {
        if (update.maxHeartRateBpm() != null && update.clearMaxHeartRate()) {
            throw new IllegalArgumentException("Set a max heart rate or go back to the default, not both.");
        }
        if (update.heartRateBoundaries() != null && update.resetHeartRateBoundaries()) {
            throw new IllegalArgumentException("Set zone boundaries or go back to the automatic ones, not both.");
        }
        if (update.maxHeartRateBpm() != null
                && (update.maxHeartRateBpm() < HeartRateZones.MIN_MAX_HEART_RATE
                || update.maxHeartRateBpm() > HeartRateZones.MAX_MAX_HEART_RATE)) {
            throw new IllegalArgumentException("Max heart rate must be between " + HeartRateZones.MIN_MAX_HEART_RATE
                    + " and " + HeartRateZones.MAX_MAX_HEART_RATE + " bpm.");
        }
        if (update.heartRateBoundaries() != null) {
            String problem = HeartRateZones.validate(update.heartRateBoundaries());
            if (problem != null) {
                throw new IllegalArgumentException(problem);
            }
        }

        ResolvedZones before = resolve(runner);
        if (update.maxHeartRateBpm() != null) {
            runner.setMaxHeartRateBpm(update.maxHeartRateBpm());
            runners.save(runner);
        } else if (update.clearMaxHeartRate() && runner.getMaxHeartRateBpm() != null) {
            runner.setMaxHeartRateBpm(null);
            runners.save(runner);
        }
        if (update.heartRateBoundaries() != null || update.resetHeartRateBoundaries()) {
            RunnerTrainingZones row = zoneRows.findByRunner(runner).orElseGet(() -> new RunnerTrainingZones(runner));
            if (update.heartRateBoundaries() != null) {
                row.setManualBoundaries(update.heartRateBoundaries());
            } else {
                row.useAutomaticBoundaries();
            }
            zoneRows.save(row);
        }

        ResolvedZones after = resolve(runner);
        boolean changed = !before.zones().equals(after.zones());
        if (changed) {
            events.publishEvent(new RunnerZonesChangedEvent(runner.getId()));
        }
        return new UpdateResult(after, changed);
    }
}
