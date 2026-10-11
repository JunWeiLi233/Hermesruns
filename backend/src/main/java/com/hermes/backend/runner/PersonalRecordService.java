package com.hermes.backend.runner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityBestEffort;
import com.hermes.backend.activity.ActivityBestEffortRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.BestEffortDistances;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * The runner's personal records: the best time at each of six distances, and the longest run, the fastest pace and the
 * most climbing.
 *
 * <p>The distance records are read from the best efforts stored for each run (see {@code BestEffortService}), so a read
 * costs a few queries and no run's points are loaded. A run's efforts are worked out when the run is ingested, and a
 * runner's own decisions count: a chip time they typed replaces the measured one, and an effort they hid is not a record.
 * Runs that have not been analysed yet are caught up in the background, so records are complete a little after a
 * deploy, not at the first request.</p>
 */
@Service
public class PersonalRecordService {
    /** Cache namespace of the per-runner personal-records response; evicted when runs change. */
    public static final String CACHE_NAMESPACE = "personal-records";

    private static final Duration PERSONAL_RECORD_CACHE_TTL = Duration.ofMinutes(10);

    /** The six distances the response has always had; their keys are what the profile page's celebrations key on. */
    private static final List<DistanceDefinition> DISTANCE_DEFINITIONS = BestEffortDistances.LEGACY_KEYS.stream()
            .map(key -> new DistanceDefinition(key, BestEffortDistances.byKey(key).orElseThrow().meters() / 1000.0))
            .toList();

    private final ActivityRepository activityRepository;
    private final ActivityBestEffortRepository bestEfforts;
    private final TtlCacheStore cacheStore;

    @Autowired
    public PersonalRecordService(
            ActivityRepository activityRepository,
            ActivityBestEffortRepository bestEfforts,
            TtlCacheStore cacheStore
    ) {
        this.activityRepository = activityRepository;
        this.bestEfforts = bestEfforts;
        this.cacheStore = cacheStore;
    }

    public PersonalRecordService(
            ActivityRepository activityRepository,
            ActivityBestEffortRepository bestEfforts
    ) {
        this(activityRepository, bestEfforts,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    public PersonalRecordsResponse buildForRunner(Runner runner) {
        String cacheKey = String.valueOf(runner.getId());
        PersonalRecordsResponse cached = cacheStore.get(CACHE_NAMESPACE, cacheKey, PersonalRecordsResponse.class).orElse(null);
        if (cached != null) {
            return cached;
        }

        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        SummaryRecord longestRun = null;
        SummaryRecord fastestPace = null;
        SummaryRecord mostElevation = null;

        for (Activity run : runs) {
            double distanceKm = resolveDistanceKm(run);
            int movingSeconds = resolveMovingSeconds(run);

            if (distanceKm > 0) {
                SummaryRecord longestCandidate = new SummaryRecord(
                        distanceKm,
                        distanceKm > 0 && movingSeconds > 0 ? movingSeconds / distanceKm : null,
                        run.getTotalElevationGain(),
                        pickRecordedAt(run),
                        run.getName(),
                        run.getId(),
                        distanceKm
                );
                if (longestRun == null || longestCandidate.primaryValue() > longestRun.primaryValue()) {
                    longestRun = longestCandidate;
                }
            }

            if (distanceKm >= 1 && movingSeconds > 0) {
                double pace = movingSeconds / distanceKm;
                SummaryRecord paceCandidate = new SummaryRecord(
                        pace,
                        pace,
                        run.getTotalElevationGain(),
                        pickRecordedAt(run),
                        run.getName(),
                        run.getId(),
                        distanceKm
                );
                if (fastestPace == null || paceCandidate.primaryValue() < fastestPace.primaryValue()) {
                    fastestPace = paceCandidate;
                }
            }

            if (run.getTotalElevationGain() != null && run.getTotalElevationGain() > 0) {
                SummaryRecord elevationCandidate = new SummaryRecord(
                        run.getTotalElevationGain(),
                        distanceKm > 0 && movingSeconds > 0 ? movingSeconds / distanceKm : null,
                        run.getTotalElevationGain(),
                        pickRecordedAt(run),
                        run.getName(),
                        run.getId(),
                        distanceKm
                );
                if (mostElevation == null || elevationCandidate.primaryValue() > mostElevation.primaryValue()) {
                    mostElevation = elevationCandidate;
                }
            }
        }

        Map<String, DistanceRecord> records = new LinkedHashMap<>();
        for (DistanceDefinition definition : DISTANCE_DEFINITIONS) {
            List<ActivityBestEffort> best = bestEfforts.findRanked(runner.getId(), definition.key(), PageRequest.of(0, 1));
            if (!best.isEmpty()) {
                records.put(definition.key(), toRecord(definition, best.get(0)));
            }
        }

        PersonalRecordsResponse response = new PersonalRecordsResponse(
                DISTANCE_DEFINITIONS,
                records,
                longestRun,
                fastestPace,
                mostElevation
        );
        cacheStore.put(CACHE_NAMESPACE, cacheKey, response, PERSONAL_RECORD_CACHE_TTL);
        return response;
    }

    private DistanceRecord toRecord(DistanceDefinition definition, ActivityBestEffort effort) {
        Activity run = effort.getActivity();
        double seconds = effort.getEffectiveSeconds();
        return new DistanceRecord(
                definition.key(),
                definition.distanceKm(),
                (int) Math.round(seconds),
                seconds / definition.distanceKm(),
                pickRecordedAt(run),
                run.getName(),
                run.getId(),
                resolveDistanceKm(run),
                !effort.isEstimated()
        );
    }

    private double resolveDistanceKm(Activity run) {
        if (run.getDistanceKm() > 0) {
            return run.getDistanceKm();
        }
        if (run.getDistanceMeters() != null && run.getDistanceMeters() > 0) {
            return run.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private int resolveMovingSeconds(Activity run) {
        if (run.getMovingTimeSeconds() > 0) {
            return run.getMovingTimeSeconds();
        }
        if (run.getDurationSeconds() != null && run.getDurationSeconds() > 0) {
            return run.getDurationSeconds().intValue();
        }
        return 0;
    }

    private String pickRecordedAt(Activity run) {
        LocalDateTime startTime = run.getStartTime();
        if (startTime != null) {
            return startTime.toString();
        }
        if (run.getStartDate() != null && !run.getStartDate().isBlank()) {
            return run.getStartDate();
        }
        if (run.getCreatedAt() != null) {
            return run.getCreatedAt().toString();
        }
        return null;
    }

    public record DistanceDefinition(String key, double distanceKm) {
    }

    public record DistanceRecord(
            String key,
            double targetDistanceKm,
            int elapsedSeconds,
            double paceSecondsPerKm,
            String recordedAt,
            String sourceRunName,
            Long activityId,
            double sourceDistanceKm,
            boolean derivedFromSegment
    ) {
    }

    public record SummaryRecord(
            double primaryValue,
            Double paceSecondsPerKm,
            Double elevationGainMeters,
            String recordedAt,
            String sourceRunName,
            Long activityId,
            double sourceDistanceKm
    ) {
    }

    public record PersonalRecordsResponse(
            List<DistanceDefinition> distances,
            Map<String, DistanceRecord> records,
            SummaryRecord longestRun,
            SummaryRecord fastestPace,
            SummaryRecord mostElevation
    ) {
    }
}
