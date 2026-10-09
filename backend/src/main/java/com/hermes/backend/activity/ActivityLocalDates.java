package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * The calendar day a run belongs to, in the runner's own time zone.
 *
 * <p>{@link Activity#getStartTime()} has no zone, and it means two different things. A run fetched from the
 * Strava API holds the clock time where the runner ran ({@code start_date_local}). A run from a file holds
 * UTC. Reading a UTC time as local would put an evening run in New York on the next day, and a morning run
 * in Sydney on the day before, so the two are told apart and the file runs are converted with the runner's
 * time zone. A runner who has not set one is treated as living in UTC.</p>
 */
public final class ActivityLocalDates {

    private ActivityLocalDates() {
    }

    public static LocalDate of(Activity activity, Runner runner) {
        LocalDateTime start = activity.getStartTime();
        if (start == null) {
            // No start time at all: the day it was added is the best there is, and no zone is known for it.
            LocalDateTime added = activity.getCreatedAt();
            return added == null ? LocalDate.now() : added.toLocalDate();
        }
        if (activity.isStravaApiSourced()) {
            return start.toLocalDate();
        }
        return start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zoneOf(runner)).toLocalDate();
    }

    /** The runner's time zone, or UTC when they have none or it is not one this server knows. */
    static ZoneId zoneOf(Runner runner) {
        String id = runner == null ? null : runner.getTimeZone();
        if (id == null || id.isBlank()) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(id.trim());
        } catch (DateTimeException unknown) {
            return ZoneOffset.UTC;
        }
    }
}
