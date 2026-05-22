package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PersonalRecordService {
    private static final Duration PERSONAL_RECORD_CACHE_TTL = Duration.ofMinutes(10);

    private static final List<DistanceDefinition> DISTANCE_DEFINITIONS = List.of(
            new DistanceDefinition("1km", 1.0),
            new DistanceDefinition("3km", 3.0),
            new DistanceDefinition("5km", 5.0),
            new DistanceDefinition("10km", 10.0),
            new DistanceDefinition("half", 21.0975),
            new DistanceDefinition("marathon", 42.195)
    );

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final TtlCacheStore cacheStore;

    @Autowired
    public PersonalRecordService(
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            TtlCacheStore cacheStore
    ) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.cacheStore = cacheStore;
    }

    public PersonalRecordService(
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository
    ) {
        this(activityRepository, activityPointRepository,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    public PersonalRecordsResponse buildForRunner(Runner runner) {
        String cacheKey = String.valueOf(runner.getId());
        PersonalRecordsResponse cached = cacheStore.get("personal-records", cacheKey, PersonalRecordsResponse.class).orElse(null);
        if (cached != null) {
            return cached;
        }

        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        Map<String, DistanceRecord> records = new LinkedHashMap<>();
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

            List<SamplePoint> samples = loadSamples(run);
            for (DistanceDefinition definition : DISTANCE_DEFINITIONS) {
                DistanceRecord candidate = computeDistanceRecord(run, definition, samples, distanceKm, movingSeconds);
                if (candidate == null) {
                    continue;
                }
                DistanceRecord current = records.get(definition.key());
                if (current == null || candidate.elapsedSeconds() < current.elapsedSeconds()) {
                    records.put(definition.key(), candidate);
                }
            }
        }

        PersonalRecordsResponse response = new PersonalRecordsResponse(
                DISTANCE_DEFINITIONS,
                records,
                longestRun,
                fastestPace,
                mostElevation
        );
        cacheStore.put("personal-records", cacheKey, response, PERSONAL_RECORD_CACHE_TTL);
        return response;
    }

    private DistanceRecord computeDistanceRecord(
            Activity run,
            DistanceDefinition definition,
            List<SamplePoint> samples,
            double distanceKm,
            int movingSeconds
    ) {
        if (!samples.isEmpty()) {
            DistanceRecord bestEffort = computeBestEffortFromSamples(run, definition, samples);
            if (bestEffort != null) {
                return bestEffort;
            }
        }

        double lower = definition.distanceKm() * 0.9;
        if (distanceKm < lower || movingSeconds <= 0) {
            return null;
        }

        int normalizedSeconds = (int) Math.round((movingSeconds / distanceKm) * definition.distanceKm());
        return new DistanceRecord(
                definition.key(),
                definition.distanceKm(),
                normalizedSeconds,
                movingSeconds / distanceKm,
                pickRecordedAt(run),
                run.getName(),
                run.getId(),
                distanceKm,
                false
        );
    }

    private DistanceRecord computeBestEffortFromSamples(Activity run, DistanceDefinition definition, List<SamplePoint> samples) {
        if (samples.size() < 2) {
            return null;
        }
        double targetMeters = definition.distanceKm() * 1000.0;
        double totalMeters = samples.get(samples.size() - 1).distanceMeters();
        if (!Double.isFinite(totalMeters) || totalMeters < targetMeters) {
            return null;
        }

        Double bestDuration = null;
        for (SamplePoint start : samples) {
            if (!Double.isFinite(start.distanceMeters()) || !Double.isFinite(start.elapsedSeconds())) {
                continue;
            }
            double startMeters = start.distanceMeters();
            double endMeters = startMeters + targetMeters;
            if (endMeters > totalMeters) {
                break;
            }
            Double endSeconds = interpolateSecondsAtDistance(samples, endMeters);
            if (endSeconds == null || endSeconds <= start.elapsedSeconds()) {
                continue;
            }
            double duration = endSeconds - start.elapsedSeconds();
            if (bestDuration == null || duration < bestDuration) {
                bestDuration = duration;
            }
        }

        if (bestDuration == null) {
            return null;
        }

        int roundedSeconds = (int) Math.round(bestDuration);
        return new DistanceRecord(
                definition.key(),
                definition.distanceKm(),
                roundedSeconds,
                bestDuration / definition.distanceKm(),
                pickRecordedAt(run),
                run.getName(),
                run.getId(),
                resolveDistanceKm(run),
                true
        );
    }

    private List<SamplePoint> loadSamples(Activity run) {
        List<Object[]> rows = activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(run.getId());
        if (rows.isEmpty()) {
            return List.of();
        }

        List<SamplePoint> samples = new java.util.ArrayList<>(rows.size());
        for (Object[] row : rows) {
            if (row == null || row.length < 4) {
                continue;
            }
            samples.add(new SamplePoint(
                    row[2] == null ? null : ((Number) row[2]).doubleValue(),
                    row[3] == null ? null : ((Number) row[3]).doubleValue()
            ));
        }
        normalizeSamples(samples, run);
        return samples;
    }

    private void normalizeSamples(List<SamplePoint> samples, Activity run) {
        if (samples.isEmpty()) {
            return;
        }

        double cumulativeMeters = 0;
        for (int i = 0; i < samples.size(); i++) {
            SamplePoint point = samples.get(i);
            if (point.distanceMeters() != null && point.distanceMeters() >= 0) {
                cumulativeMeters = Math.max(cumulativeMeters, point.distanceMeters());
                continue;
            }
            samples.set(i, new SamplePoint(point.elapsedSeconds(), cumulativeMeters));
        }

        Double maxKnownSeconds = null;
        for (SamplePoint point : samples) {
            if (point.elapsedSeconds() != null) {
                maxKnownSeconds = point.elapsedSeconds();
            }
        }

        int totalSeconds = maxKnownSeconds != null && maxKnownSeconds > 0
                ? maxKnownSeconds.intValue()
                : resolveMovingSeconds(run);
        double totalMeters = samples.get(samples.size() - 1).distanceMeters() == null
                ? resolveDistanceKm(run) * 1000.0
                : samples.get(samples.size() - 1).distanceMeters();

        if (totalSeconds <= 0 || totalMeters <= 0) {
            return;
        }

        for (int i = 0; i < samples.size(); i++) {
            SamplePoint point = samples.get(i);
            if (point.elapsedSeconds() != null) {
                continue;
            }
            double seconds = (point.distanceMeters() / totalMeters) * totalSeconds;
            samples.set(i, new SamplePoint(seconds, point.distanceMeters()));
        }
    }

    private Double interpolateSecondsAtDistance(List<SamplePoint> samples, double targetMeters) {
        if (samples.isEmpty()) {
            return null;
        }
        for (int i = 1; i < samples.size(); i++) {
            SamplePoint previous = samples.get(i - 1);
            SamplePoint current = samples.get(i);
            if (!isFinite(previous.elapsedSeconds(), previous.distanceMeters(), current.elapsedSeconds(), current.distanceMeters())) {
                continue;
            }
            if (targetMeters > current.distanceMeters()) {
                continue;
            }
            double span = current.distanceMeters() - previous.distanceMeters();
            if (span <= 0) {
                return current.elapsedSeconds();
            }
            double ratio = (targetMeters - previous.distanceMeters()) / span;
            return previous.elapsedSeconds() + ratio * (current.elapsedSeconds() - previous.elapsedSeconds());
        }
        SamplePoint last = samples.get(samples.size() - 1);
        return last.elapsedSeconds();
    }

    private boolean isFinite(Double... values) {
        for (Double value : values) {
            if (value == null || !Double.isFinite(value)) {
                return false;
            }
        }
        return true;
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

    private record SamplePoint(Double elapsedSeconds, Double distanceMeters) {
    }
}
