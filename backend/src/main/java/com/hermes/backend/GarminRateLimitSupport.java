package com.hermes.backend;

import java.util.Locale;

final class GarminRateLimitSupport {
    static final long DEFAULT_RETRY_AFTER_SECONDS = 15 * 60;
    private static final long MIN_RETRY_AFTER_SECONDS = 60;
    private static final long MAX_RETRY_AFTER_SECONDS = 60 * 60;

    private GarminRateLimitSupport() {
    }

    static boolean isRateLimited(Object errorCode, String message) {
        if ("GARMIN_RATE_LIMITED".equals(String.valueOf(errorCode))) {
            return true;
        }
        if (message == null || message.isBlank()) {
            return false;
        }
        String normalized = message.toLowerCase(Locale.ROOT);
        return normalized.contains("429")
                || normalized.contains("too many requests")
                || normalized.contains("rate limit")
                || normalized.contains("rate limiting");
    }

    static long retryAfterSeconds(Object rawRetryAfter) {
        long parsed = DEFAULT_RETRY_AFTER_SECONDS;
        if (rawRetryAfter instanceof Number number) {
            parsed = number.longValue();
        } else if (rawRetryAfter != null) {
            try {
                parsed = Long.parseLong(String.valueOf(rawRetryAfter));
            } catch (NumberFormatException ignored) {
                parsed = DEFAULT_RETRY_AFTER_SECONDS;
            }
        }
        return Math.max(MIN_RETRY_AFTER_SECONDS, Math.min(MAX_RETRY_AFTER_SECONDS, parsed));
    }

    static String message(long retryAfterSeconds) {
        long minutes = Math.max(1, (long) Math.ceil(retryAfterSeconds / 60.0));
        return "Garmin is temporarily rate limiting login attempts. Please wait about "
                + minutes
                + " minutes before trying again.";
    }
}
