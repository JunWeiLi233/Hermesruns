package com.hermes.backend.runner;

import com.hermes.backend.activity.ActivityLocalDates;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The race a runner cut their pace zones from (see docs/README-ANALYSIS.md, "Pace zones from a race"): read it, replace it, remove
 * it. The rules only keep out what no runner could have run: a distance from 1.5 km to 100 km, a time from 4 minutes to 24 hours
 * that is a pace from 2:00 to 20:00 a kilometre, a date no later than the runner's today and no more than five years back. The
 * arithmetic that turns a race into zones is not here.
 */
@Service
public class PaceZoneRaceService {

    public static final double MIN_DISTANCE_METERS = 1500;
    public static final double MAX_DISTANCE_METERS = 100_000;
    public static final int MIN_SECONDS = 240;
    public static final int MAX_SECONDS = 86_400;
    /** Seconds per kilometre: faster than the fastest 5 km ever run, and slower than a walk. */
    public static final double MIN_PACE_SECONDS_PER_KM = 120;
    public static final double MAX_PACE_SECONDS_PER_KM = 1200;
    public static final int MAX_AGE_DAYS = 5 * 365;

    /** A race, as the API gives it. */
    public record Race(double distanceMeters, int seconds, LocalDate date, java.time.LocalDateTime updatedAt) {
    }

    private final RunnerPaceZoneRaceRepository rows;
    private final RunnerRepository runners;
    private final Clock clock;

    @Autowired
    public PaceZoneRaceService(RunnerPaceZoneRaceRepository rows, RunnerRepository runners) {
        this(rows, runners, Clock.systemUTC());
    }

    PaceZoneRaceService(RunnerPaceZoneRaceRepository rows, RunnerRepository runners, Clock clock) {
        this.rows = rows;
        this.runners = runners;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<Race> get(Runner runner) {
        return rows.findByRunner(runner).map(PaceZoneRaceService::of);
    }

    /**
     * Sets the race, replacing the one there was.
     *
     * @throws IllegalArgumentException with a plain reason when a value is refused
     */
    @Transactional
    public Race set(Runner runner, double distanceMeters, int seconds, LocalDate date) {
        validate(runner, distanceMeters, seconds, date);
        // Two requests of the same runner take turns on the runner's row: the second finds the race the first made and replaces it.
        // (Catching the unique index's refusal instead leaves a PostgreSQL transaction aborted, with nothing more to be done in it.)
        Runner owner = runners.findByIdForUpdate(runner.getId()).orElse(runner);
        RunnerPaceZoneRace row = rows.findByRunner(owner).orElseGet(() -> new RunnerPaceZoneRace(owner));
        row.set(Math.round(distanceMeters * 10.0) / 10.0, seconds, date);
        return of(rows.saveAndFlush(row));
    }

    /** Removes the race; the zones go back to the fitness worked out from the runner's runs. Nothing to remove is not an error. */
    @Transactional
    public void clear(Runner runner) {
        rows.findByRunner(runner).ifPresent(rows::delete);
        rows.flush();
    }

    void validate(Runner runner, double distanceMeters, int seconds, LocalDate date) {
        if (!Double.isFinite(distanceMeters) || distanceMeters < MIN_DISTANCE_METERS || distanceMeters > MAX_DISTANCE_METERS) {
            throw new IllegalArgumentException("The distance must be from 1.5 km to 100 km.");
        }
        if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
            throw new IllegalArgumentException("The time must be from 4 minutes to 24 hours.");
        }
        double pace = seconds / (distanceMeters / 1000.0);
        if (pace < MIN_PACE_SECONDS_PER_KM || pace > MAX_PACE_SECONDS_PER_KM) {
            throw new IllegalArgumentException("That time is not a pace a runner could hold for that distance (2:00 to 20:00 a kilometre).");
        }
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        if (date == null) {
            throw new IllegalArgumentException("Give the date of the race.");
        }
        if (date.isAfter(today)) {
            throw new IllegalArgumentException("The race cannot be in the future.");
        }
        if (date.isBefore(today.minusDays(MAX_AGE_DAYS))) {
            throw new IllegalArgumentException("A race from more than five years ago says little about your pace now.");
        }
    }

    private static Race of(RunnerPaceZoneRace row) {
        return new Race(row.getDistanceMeters(), row.getTimeSeconds(), row.getRaceDate(), row.getUpdatedAt());
    }
}
