package com.hermes.backend;

import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class WeatherAdjustedFitnessService {
    public WeatherAdjustedFitnessService() {
    }

    public WeatherAdjustedFitnessResult calculateAdjustedFitness(List<Activity> activities) {
        List<AdjustedActivityEntry> adjustedEntries = new ArrayList<>();

        for (Activity activity : activities) {
            if (activity.getActivityType() != ActivityType.RUN) continue;

            Integer penalty = activity.getPacePenaltySecPerKm();
            if (penalty == null) {
                // If not cached, we could calculate it on the fly,
                // but that might be expensive if many activities lack it.
                // For now, assume it might be null and default to 0 or try to calc if recent.
                penalty = 0;
            }

            adjustedEntries.add(new AdjustedActivityEntry(
                activity.getId(),
                activity.getName(),
                resolvedDistanceKm(activity),
                resolvedMovingTimeSeconds(activity),
                activity.getAverageHeartRate(),
                penalty
            ));
        }

        return new WeatherAdjustedFitnessResult(adjustedEntries);
    }

    private double resolvedDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) return activity.getDistanceKm();
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0.0;
    }

    private int resolvedMovingTimeSeconds(Activity activity) {
        if (activity.getMovingTimeSeconds() > 0) return activity.getMovingTimeSeconds();
        if (activity.getDurationSeconds() != null && activity.getDurationSeconds() > 0) {
            return Math.toIntExact(activity.getDurationSeconds());
        }
        return 0;
    }

    public record WeatherAdjustedFitnessResult(
        List<AdjustedActivityEntry> activities
    ) {}

    public record AdjustedActivityEntry(
        Long id,
        String name,
        double distanceKm,
        int movingTimeSeconds,
        Double averageHeartRate,
        int pacePenaltySecPerKm
    ) {}
}
