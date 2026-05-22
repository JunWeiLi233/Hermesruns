package com.hermes.backend;

/**
 * Response DTO for GET /api/activities/{id}/improvement.
 *
 * When {@code available} is false the frontend should hide the improvement section.
 * Only populated when the runner has at least 3 baseline runs in the same distance bucket.
 */
public record ActivityImprovementMetric(
        /** Number of baseline runs found in the same distance bucket. */
        int baseRunCount,
        /** Whether enough baseline runs were available to produce a reliable delta. */
        boolean available,
        /**
         * Signed pace delta in seconds/km: positive = this run was SLOWER,
         * negative = this run was FASTER than baseline average.
         * Null when available=false.
         */
        Double paceDeltaSecondsPerKm,
        /** True when this run's pace was faster (lower sec/km) than the baseline average. */
        Boolean paceImproved,
        /** Human-readable distance bucket label, e.g. "5–6 km". */
        String distanceBucket,
        /** Describes what the comparison is based on. */
        String basis
) {}
