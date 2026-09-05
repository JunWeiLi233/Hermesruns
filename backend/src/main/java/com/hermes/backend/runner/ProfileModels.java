package com.hermes.backend.runner;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.hermes.backend.coaching.AutomatedCoachService;
import com.hermes.backend.shoes.Shoe;
import java.util.List;
import java.util.Map;

public final class ProfileModels {
    private ProfileModels() {}

    public record ProfileResponse(
            String email,
            String displayName,
            String avatarUrl,
            boolean stravaLinked,
            boolean showLanguageSettingsHint
    ) {
    }

    public record ProfileDashboardResponse(
            ProfileResponse profile,
            List<Map<String, Object>> activities,
            AutomatedCoachService.CoachStateDto coachState,
            AutomatedCoachService.CoachTodayDto coachToday,
            Object personalRecords,
            List<RaceEventResponse> races,
            Object musclePlan,
            Object quota,
            boolean deferredEnrichment
    ) {
    }

    public record TodayDashboardResponse(
            ProfileResponse profile,
            List<Map<String, Object>> activities,
            AutomatedCoachService.CoachTodayDto coachToday,
            Object weather,
            List<RaceEventResponse> races,
            List<Shoe> shoes
    ) {
    }

    public record ProfilePreferencesResponse(String mantra, boolean weeklyDigestEnabled) {
    }

    public record HeatPoint(long activityId, double latitude, double longitude, double intensity, double speedRatio) {
        @JsonValue
        public Object[] toJson() {
            return new Object[]{activityId, latitude, longitude, speedRatio};
        }

        // Inverse of toJson() so the server-side response cache can actually
        // deserialize its own payloads — without this creator every cache
        // "hit" failed to decode and the full point set was re-queried.
        @JsonCreator
        public static HeatPoint fromJson(double[] values) {
            boolean hasIntensity = values.length > 4;
            return new HeatPoint(
                    (long) values[0],
                    values[1],
                    values[2],
                    hasIntensity ? values[3] : 0.0,
                    values[values.length - 1]
            );
        }
    }

    public record HeatmapBounds(
            double minLatitude,
            double minLongitude,
            double maxLatitude,
            double maxLongitude
    ) {
    }

    public record HeatmapDiagnostics(
            long sourceGpsPointCount,
            int queriedGpsPointCount,
            int returnedGpsPointCount,
            boolean complete
    ) {
    }

    public record HeatmapPage(
            long offset,
            int limit,
            int returnedPointCount,
            boolean hasMore
    ) {
    }

    public record HeatmapResponse(
            List<HeatPoint> points,
            long pointCount,
            int sampledPointCount,
            long activityCount,
            HeatmapBounds bounds,
            HeatmapDiagnostics diagnostics,
            HeatmapPage page
    ) {
    }

    public record LinkedActivitySummary(
            Long id,
            String name,
            java.time.LocalDateTime startTime,
            String startDate,
            double distanceKm,
            int movingTimeSeconds
    ) {
    }

    public record RaceEventResponse(
            Long id,
            String name,
            String organization,
            String location,
            java.time.LocalDate eventDate,
            Double distanceKm,
            String registrationStatus,
            Integer goalTimeSeconds,
            String notes,
            boolean nyrrNinePlusOneEligible,
            Long completedActivityId,
            boolean completed,
            long countdownDays,
            LinkedActivitySummary matchedActivity
    ) {
    }
}
