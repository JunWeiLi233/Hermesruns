package com.hermes.backend;

import java.util.Locale;

final class ActivityTypeResolver {
    private ActivityTypeResolver() {
    }

    static ActivityType fromSportLabels(String... rawLabels) {
        boolean sawGenericOnly = false;

        for (String rawLabel : rawLabels) {
            String normalized = normalize(rawLabel);
            if (normalized == null) {
                continue;
            }

            if (isRunLabel(normalized)) {
                return ActivityType.RUN;
            }

            if (isGenericLabel(normalized)) {
                sawGenericOnly = true;
                continue;
            }

            return ActivityType.NON_RUN;
        }

        return sawGenericOnly ? ActivityType.UNKNOWN : ActivityType.UNKNOWN;
    }

    static ActivityType inferStoredActivityType(Activity activity) {
        if (activity == null) {
            return ActivityType.UNKNOWN;
        }

        if (activity.getActivityType() != null) {
            return activity.getActivityType();
        }

        return fromSportLabels(activity.getName(), activity.getSourceFileName());
    }

    private static boolean isRunLabel(String normalized) {
        return hasToken(normalized, "run")
                || hasToken(normalized, "running")
                || hasToken(normalized, "trail run")
                || hasToken(normalized, "trailrunning")
                || hasToken(normalized, "treadmill")
                || hasToken(normalized, "jog")
                || hasToken(normalized, "jogging");
    }

    private static boolean isGenericLabel(String normalized) {
        return switch (normalized) {
            case "activity", "exercise", "generic", "other", "training", "unknown", "workout" -> true;
            default -> false;
        };
    }

    private static boolean hasToken(String normalized, String token) {
        return (" " + normalized + " ").contains(" " + token + " ");
    }

    private static String normalize(String rawLabel) {
        if (rawLabel == null || rawLabel.isBlank()) {
            return null;
        }

        String camelSplit = rawLabel.trim().replaceAll("([a-z])([A-Z])", "$1 $2");
        String normalized = camelSplit
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z]+", " ")
                .trim();

        return normalized.isBlank() ? null : normalized;
    }
}
