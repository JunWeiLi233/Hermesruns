package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

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
        return of(start, activity.isStravaApiSourced(), runner);
    }

    public static LocalDate of(LocalDateTime start, boolean stravaApiSourced, Runner runner) {
        if (stravaApiSourced) {
            return start.toLocalDate();
        }
        return start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zoneOf(runner)).toLocalDate();
    }

    /** Additive read contract. Legacy Strava wall times lack the source zone/UTC instant;
     * do not manufacture an instant from the account's current zone. */
    public static Map<String, Object> responseFields(LocalDateTime start, boolean stravaApiSourced, Runner runner) {
        Map<String, Object> fields = new LinkedHashMap<>();
        LocalDateTime local = start == null || stravaApiSourced ? start
                : start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zoneOf(runner)).toLocalDateTime();
        fields.put("activityInstant", start == null || stravaApiSourced ? null : start.toInstant(ZoneOffset.UTC).toString());
        fields.put("accountLocalDate", local == null ? null : local.toLocalDate().toString());
        fields.put("accountLocalTime", local == null ? null : local.toLocalTime().toString());
        fields.put("accountTimeZone", zoneOf(runner).getId());
        fields.put("timeRepresentation", start == null ? "UNKNOWN" : stravaApiSourced ? "STRAVA_LOCAL_WALL_TIME" : "UTC_INSTANT");
        return fields;
    }

    /** Clock time on the account calendar for the lightweight coaching projection. */
    public static LocalDateTime localStartTimeOf(RunMetricsProjection run, Runner runner) {
        LocalDateTime start = run.getStartTime();
        if (start == null) return run.getEffectiveStartTime();
        return Boolean.TRUE.equals(run.getStravaApiSourced()) ? start
                : start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zoneOf(runner)).toLocalDateTime();
    }

    public static LocalDate placed(LocalDate filedUnder, LocalDateTime start, LocalDateTime createdAt, Boolean stravaApiSourced, ZoneId zone) {
        if (filedUnder != null) {
            return filedUnder;
        }
        if (start == null) {
            return createdAt == null ? LocalDate.now() : createdAt.toLocalDate();
        }
        if (Boolean.TRUE.equals(stravaApiSourced)) {
            return start.toLocalDate();
        }
        return start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone).toLocalDate();
    }

    /**
     * The clock time on the wall where the runner ran: what a screen prints as the time of a run (BUG-003). A run fetched from
     * the Strava API holds that already; a run from a file holds UTC, which is moved to the runner's zone (so an evening run in
     * New York is not shown as the next morning). Without a time zone on the profile the zone is UTC and nothing moves.
     */
    public static LocalDateTime startTimeOf(Activity activity, ZoneId zone) {
        return localStart(activity.getStartTime(), activity.isStravaApiSourced(), zone);
    }

    /** {@link #startTimeOf} from what a query returns rather than from the entity. */
    public static LocalDateTime localStart(LocalDateTime start, Boolean stravaApiSourced, ZoneId zone) {
        if (start == null || Boolean.TRUE.equals(stravaApiSourced)) {
            return start;
        }
        return start.atOffset(ZoneOffset.UTC).atZoneSameInstant(zone == null ? ZoneOffset.UTC : zone).toLocalDateTime();
    }

    /**
     * The start date text to send along with {@link #startTimeOf}: a file run's is the stored start time written out, so it
     * moves with it; a Strava run's, and a run with no start time, is kept as it was stored.
     */
    public static String startDateOf(Activity activity, ZoneId zone) {
        return localStartDate(activity.getStartDate(), activity.getStartTime(), activity.isStravaApiSourced(), zone);
    }

    /** {@link #startDateOf} from what a query returns rather than from the entity. */
    public static String localStartDate(String startDate, LocalDateTime start, Boolean stravaApiSourced, ZoneId zone) {
        if (start == null || Boolean.TRUE.equals(stravaApiSourced)) {
            return startDate;
        }
        return localStart(start, false, zone).toString();
    }

    /** The runner's time zone, or UTC when they have none or it is not one this server knows. */
    public static ZoneId zoneOf(Runner runner) {
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
