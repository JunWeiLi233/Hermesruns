package com.hermes.backend;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;

public record ActivityRunSummary(
        Long id,
        String name,
        ImportProvider provider,
        ActivityType activityType,
        LocalDateTime startTime,
        double distanceKm,
        long movingTimeSeconds
) {
    public static ActivityRunSummary from(Activity activity) {
        ActivityType resolvedType = ActivityTypeResolver.inferStoredActivityType(activity);
        return new ActivityRunSummary(
                activity.getId(),
                resolveName(activity),
                resolveProvider(activity),
                resolvedType,
                resolveStartTime(activity),
                resolveDistanceKm(activity),
                resolveMovingTimeSeconds(activity)
        );
    }

    private static String resolveName(Activity activity) {
        if (activity.getName() != null && !activity.getName().isBlank()) {
            return activity.getName().trim();
        }
        return "Run";
    }

    private static ImportProvider resolveProvider(Activity activity) {
        if (activity.getProvider() != null) {
            return activity.getProvider();
        }
        return activity.getStravaId() != null ? ImportProvider.STRAVA : null;
    }

    private static LocalDateTime resolveStartTime(Activity activity) {
        if (activity.getStartTime() != null) {
            return activity.getStartTime();
        }

        String startDate = activity.getStartDate();
        if (startDate == null || startDate.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(startDate.trim()).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(startDate.trim());
            } catch (Exception secondIgnored) {
                return null;
            }
        }
    }

    private static double resolveDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0d) {
            return activity.getDistanceKm();
        }

        Double distanceMeters = activity.getDistanceMeters();
        if (distanceMeters != null && distanceMeters > 0d) {
            return distanceMeters / 1000d;
        }

        return 0d;
    }

    private static long resolveMovingTimeSeconds(Activity activity) {
        if (activity.getMovingTimeSeconds() > 0) {
            return activity.getMovingTimeSeconds();
        }

        Long durationSeconds = activity.getDurationSeconds();
        if (durationSeconds != null && durationSeconds > 0L) {
            return durationSeconds;
        }

        return 0L;
    }
}
