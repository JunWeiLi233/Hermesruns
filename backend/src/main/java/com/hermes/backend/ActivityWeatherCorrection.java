package com.hermes.backend;

final class ActivityWeatherCorrection {
    private ActivityWeatherCorrection() {
    }

    static Value from(Activity activity) {
        if (activity == null) {
            return neutral();
        }
        return fromRawFields(
                activity.getDistanceKm(),
                activity.getDistanceMeters(),
                activity.getMovingTimeSeconds(),
                activity.getDurationSeconds(),
                activity.getPacePenaltySecPerKm(),
                activity.getWeatherAdjusted()
        );
    }

    static Value fromRawFields(
            Double distanceKm,
            Double distanceMeters,
            Integer movingTimeSeconds,
            Long durationSeconds,
            Integer pacePenaltySecPerKm,
            Boolean weatherAdjusted
    ) {
        double resolvedDistanceKm = resolveDistanceKm(distanceKm, distanceMeters);
        int resolvedMovingSeconds = resolveMovingSeconds(movingTimeSeconds, durationSeconds);
        int resolvedPenalty = Math.max(0, pacePenaltySecPerKm == null ? 0 : pacePenaltySecPerKm);

        if (resolvedDistanceKm <= 0 || resolvedMovingSeconds <= 0) {
            return new Value(resolvedPenalty, false, null, null, null);
        }

        double rawPaceSecPerKm = resolvedMovingSeconds / resolvedDistanceKm;
        double adjustedPaceSecPerKm = Math.max(1.0, rawPaceSecPerKm - resolvedPenalty);
        int adjustedMovingTimeSeconds = Math.max(1, (int) Math.round(adjustedPaceSecPerKm * resolvedDistanceKm));
        boolean hasAdjustment = Boolean.TRUE.equals(weatherAdjusted) || resolvedPenalty > 0;
        boolean meaningfulAdjustment = hasAdjustment && adjustedMovingTimeSeconds < resolvedMovingSeconds;

        return new Value(
                resolvedPenalty,
                meaningfulAdjustment,
                adjustedMovingTimeSeconds,
                round(adjustedPaceSecPerKm, 1),
                round(adjustedMovingTimeSeconds / (double) resolvedMovingSeconds, 4)
        );
    }

    private static Value neutral() {
        return new Value(0, false, null, null, null);
    }

    private static double resolveDistanceKm(Double distanceKm, Double distanceMeters) {
        if (distanceKm != null && distanceKm > 0) {
            return distanceKm;
        }
        if (distanceMeters != null && distanceMeters > 0) {
            return distanceMeters / 1000.0;
        }
        return 0.0;
    }

    private static int resolveMovingSeconds(Integer movingTimeSeconds, Long durationSeconds) {
        if (movingTimeSeconds != null && movingTimeSeconds > 0) {
            return movingTimeSeconds;
        }
        if (durationSeconds != null && durationSeconds > 0) {
            return Math.toIntExact(durationSeconds);
        }
        return 0;
    }

    private static double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }

    record Value(
            int pacePenaltySecPerKm,
            boolean weatherAdjusted,
            Integer weatherAdjustedMovingTimeSeconds,
            Double weatherAdjustedPaceSecPerKm,
            Double weatherCorrectionFactor
    ) {
    }
}
