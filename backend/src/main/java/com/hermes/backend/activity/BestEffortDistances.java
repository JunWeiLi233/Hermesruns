package com.hermes.backend.activity;

import java.util.List;
import java.util.Optional;

/**
 * The distances a run's best efforts are worked out for, shortest first: Strava's fourteen (400 m to 50 K) and the 3 km
 * Hermes has always had.
 */
public final class BestEffortDistances {

    /** @param key stable, stored and sent to the browser; @param meters the length of the effort */
    public record Distance(String key, double meters) {
    }

    public static final List<Distance> ALL = List.of(
            new Distance("400m", 400.0),
            new Distance("half_mile", 804.672),
            new Distance("1km", 1000.0),
            new Distance("1mile", 1609.344),
            new Distance("3km", 3000.0),
            new Distance("2mile", 3218.688),
            new Distance("5km", 5000.0),
            new Distance("10km", 10000.0),
            new Distance("15km", 15000.0),
            new Distance("10mile", 16093.44),
            new Distance("20km", 20000.0),
            new Distance("half", 21097.5),
            new Distance("30km", 30000.0),
            new Distance("marathon", 42195.0),
            new Distance("50km", 50000.0)
    );

    /**
     * The six distances the personal-records response has always had. The profile page celebrates a new record per
     * key, so these keys and their lengths do not change.
     */
    public static final List<String> LEGACY_KEYS = List.of("1km", "3km", "5km", "10km", "half", "marathon");

    private BestEffortDistances() {
    }

    public static Optional<Distance> byKey(String key) {
        return ALL.stream().filter(distance -> distance.key().equals(key)).findFirst();
    }
}
