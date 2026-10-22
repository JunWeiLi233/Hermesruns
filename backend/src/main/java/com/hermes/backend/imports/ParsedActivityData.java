package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityType;
import java.time.LocalDateTime;
import java.util.List;

public record ParsedActivityData(
        String name,
        ActivityType activityType,
        LocalDateTime startTime,
        Double distanceMeters,
        Long durationSeconds,
        List<ParsedTrackPoint> points,
        Double averageHeartRate,
        Double maxHeartRate,
        List<com.hermes.backend.activity.analysis.SessionAnalysisSources.Lap> sourceLaps,
        SourceMetadata source
) {
    public record SourceMetadata(String originalSport, String originalSubtype, Boolean commute,
            Boolean trainer, String gear, String recordedOffset, Long elapsedSeconds) {}

    public ParsedActivityData(String name, ActivityType activityType, LocalDateTime startTime,
            Double distanceMeters, Long durationSeconds, List<ParsedTrackPoint> points,
            Double averageHeartRate, Double maxHeartRate,
            List<com.hermes.backend.activity.analysis.SessionAnalysisSources.Lap> sourceLaps) {
        this(name, activityType, startTime, distanceMeters, durationSeconds, points,
                averageHeartRate, maxHeartRate, sourceLaps, null);
    }
    /** Existing parsers with no supported original laps retain their unknown contract. */
    public ParsedActivityData(String name, ActivityType activityType, LocalDateTime startTime,
            Double distanceMeters, Long durationSeconds, List<ParsedTrackPoint> points,
            Double averageHeartRate, Double maxHeartRate) {
        this(name, activityType, startTime, distanceMeters, durationSeconds, points,
                averageHeartRate, maxHeartRate, List.of());
    }
}
