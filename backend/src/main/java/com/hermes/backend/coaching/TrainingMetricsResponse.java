package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * What the run page shows about one run's effort and heart-rate zones. Built from the stored row, never the
 * row itself, so internals (the model version, the stale flag, the raw pace score) stay inside.
 *
 * @param effort    the score and where it came from; {@code score} is null when there was nothing to base one on
 * @param heartRate the zone breakdown; {@code hasStream} says whether the run has a heart-rate stream to break down
 */
public record TrainingMetricsResponse(Long activityId, LocalDate localDate, Effort effort, HeartRate heartRate,
                                      LocalDateTime computedAt) {

    /**
     * @param source one of HR_ZONES, PERCEIVED, HR_AVERAGE, PACE_MODEL, PACE_CALIBRATED, or null with no score
     */
    public record Effort(Double score, String source, Integer perceivedExertion) {
    }

    /**
     * @param averageHeartRate  the run's average, from the device or the stream; null when unknown
     * @param maxHeartRate      the run's peak; null when unknown
     * @param coveredSeconds    seconds the heart-rate samples stand for
     * @param coveragePercent   how much of the moving time that is, 0 to 100; null when unknown
     * @param maxHeartRateBpm   the max heart rate the zones were built on
     * @param maxHeartRateSource PROFILE (the runner set it) or DEFAULT
     * @param boundarySource    AUTO (percentages of the max heart rate) or MANUAL (the runner's own)
     */
    public record HeartRate(boolean hasStream, Double averageHeartRate, Double maxHeartRate, int coveredSeconds,
                            Integer coveragePercent, List<Zone> zones, int maxHeartRateBpm,
                            String maxHeartRateSource, String boundarySource) {
    }

    /**
     * @param fromBpm the first bpm of the zone; null for zone 1, which has no lower edge
     * @param toBpm   the last bpm of the zone; null for zone 5, which has no upper edge
     * @param percent share of the covered time, 0 to 100
     */
    public record Zone(int zone, Integer fromBpm, Integer toBpm, int seconds, double percent) {
    }

    static TrainingMetricsResponse of(Activity activity, ActivityTrainingMetrics row, TrainingZonesService.ResolvedZones resolved) {
        HeartRateZones zones = row.zonesUsed();
        int[] seconds = row.zoneSeconds();
        int covered = row.getHrCoveredSeconds();
        boolean hasStream = covered >= EffortModel.MIN_HR_SECONDS;

        List<Zone> zoneList = new ArrayList<>(HeartRateZones.ZONE_COUNT);
        for (int i = 0; i < HeartRateZones.ZONE_COUNT; i++) {
            Integer from = i == 0 ? null : zones.boundary(i - 1);
            Integer to = i == HeartRateZones.BOUNDARY_COUNT ? null : zones.boundary(i) - 1;
            double percent = covered > 0 ? Math.round(seconds[i] * 1000.0 / covered) / 10.0 : 0.0;
            zoneList.add(new Zone(i + 1, from, to, seconds[i], percent));
        }

        int moving = activity.getMovingTimeSeconds() > 0
                ? activity.getMovingTimeSeconds()
                : (activity.getDurationSeconds() == null ? 0 : (int) Math.min(Integer.MAX_VALUE, activity.getDurationSeconds()));
        Integer coveragePercent = moving > 0 && covered > 0 ? Math.min(100, (int) Math.round(covered * 100.0 / moving)) : null;

        return new TrainingMetricsResponse(
                activity.getId(),
                row.getLocalDate(),
                new Effort(row.getEffortScore(), row.getEffortSource(), row.getPerceivedExertionUsed()),
                new HeartRate(hasStream, activity.getAverageHeartRate(), activity.getMaxHeartRate(), covered,
                        coveragePercent, zoneList, zones.maxHeartRate(), resolved.maxHeartRateSource(),
                        resolved.boundarySource()),
                row.getComputedAt());
    }
}
