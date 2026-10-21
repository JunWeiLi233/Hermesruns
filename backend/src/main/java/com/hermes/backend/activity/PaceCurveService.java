package com.hermes.backend.activity;

import com.hermes.backend.activity.BestEffortDistances.Distance;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The runner's pace curve: their fastest measured time over each standard distance within a window of days, which is
 * how fast they have held each length of effort, and the critical speed those efforts line up on (see
 * {@link CriticalSpeedModel}). Read from the best efforts every run already carries (see {@link BestEffortService}), so
 * nothing is stored for it and it cannot drift from the runs it is made of.
 *
 * <p>An effort the runner hid is not here. An effort that is only an estimate (a run with no stream, whose average pace was
 * carried over to the distance) is not either: a curve of what a runner has held must be made of what they were measured
 * holding. A time the runner typed in (a chip time) counts as they typed it.</p>
 */
@Service
public class PaceCurveService {

    public static final int DEFAULT_DAYS = 180;
    public static final int MAX_DAYS = 3660;

    /** The earliest day an "all time" window reaches back to. */
    private static final LocalDate THE_BEGINNING = LocalDate.of(1970, 1, 1);

    /**
     * @param key      the distance key, as in {@link BestEffortDistances}
     * @param seconds  the time that counts (a typed one when there is one)
     * @param activityId the run it was run in
     * @param edited   the runner typed this time
     * @param inModel  the line is fitted through this effort
     */
    public record Point(String key, double meters, double seconds, double paceSecondsPerKm, LocalDate date, Long activityId,
                        String name, boolean edited, boolean inModel) {
    }

    /**
     * @param status               {@code ok}, {@code rough}, {@code too_few_points}, {@code narrow_range},
     *                             {@code negative_d_prime} or {@code no_fit} (see {@link CriticalSpeedModel.Status})
     * @param criticalSpeedMps     null unless the status is {@code ok} or {@code rough}
     * @param criticalPaceSecondsPerKm the same speed as a pace
     * @param dPrimeMeters         the distance above the critical speed
     * @param pointsUsed           how many efforts lasted between the shortest and the longest the line takes
     * @param maxErrorPercent      the worst gap between the line's time and an effort's own, in percent of that time
     */
    public record Model(String status, Double criticalSpeedMps, Double criticalPaceSecondsPerKm, Double dPrimeMeters,
                        int pointsUsed, Double maxErrorPercent) {
    }

    /** The conventions the fit follows, so the screen can say them. */
    public record Limits(int minSeconds, int maxSeconds, int minPoints, double minSpread, double okErrorPercent,
                         double roughErrorPercent) {
    }

    /**
     * @param days     the window in days up to today, or null for all time
     * @param from     the first day of the window, or null for all time
     * @param complete false while some of the runner's runs have not been analysed, so more efforts may join
     * @param points   the fastest effort at each distance the runner has one for, shortest distance first
     */
    public record PaceCurveResponse(LocalDate today, String timeZone, Integer days, LocalDate from, LocalDate to,
                                    boolean complete, List<Point> points, Model model, Limits limits) {
    }

    private final ActivityBestEffortRepository efforts;
    private final Clock clock;

    @Autowired
    public PaceCurveService(ActivityBestEffortRepository efforts) {
        this(efforts, Clock.systemUTC());
    }

    PaceCurveService(ActivityBestEffortRepository efforts, Clock clock) {
        this.efforts = efforts;
        this.clock = clock;
    }

    /**
     * @param days     how many days up to and including the runner's today (1 to {@link #MAX_DAYS}), or null for all time
     * @param complete whether every run of the runner has been analysed, passed through to the answer
     * @throws IllegalArgumentException when {@code days} is out of range
     */
    @Transactional(readOnly = true)
    public PaceCurveResponse paceCurve(Runner runner, Integer days, boolean complete) {
        if (days != null && (days < 1 || days > MAX_DAYS)) {
            throw new IllegalArgumentException("Ask for 1 to " + MAX_DAYS + " days, or all of them.");
        }
        ZoneId zone = ActivityLocalDates.zoneOf(runner);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate from = days == null ? null : today.minusDays(days - 1L);
        LocalDate readFrom = from == null ? THE_BEGINNING : from;

        List<ActivityBestEffort> best = new ArrayList<>();
        for (Distance distance : BestEffortDistances.ALL) {
            List<ActivityBestEffort> fastest = efforts.findFastestMeasuredBetween(runner.getId(), distance.key(), readFrom, today,
                    PageRequest.of(0, 1));
            if (!fastest.isEmpty()) {
                best.add(fastest.get(0));
            }
        }

        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(best.stream()
                .map(row -> new CriticalSpeedModel.Point(row.getDistanceKey(), row.getDistanceMeters(), row.getEffectiveSeconds()))
                .toList());
        boolean modelled = fit.status().hasNumbers();

        List<Point> points = new ArrayList<>();
        for (ActivityBestEffort row : best) {
            points.add(new Point(row.getDistanceKey(), row.getDistanceMeters(), round1(row.getEffectiveSeconds()),
                    BestEffortService.paceOf(row.getEffectiveSeconds(), row.getDistanceMeters()), row.getLocalDate(),
                    row.getActivity().getId(), row.getActivity().getName(), row.getEditedElapsedSeconds() != null,
                    modelled && fit.usedKeys().contains(row.getDistanceKey())));
        }
        Model model = new Model(fit.status().code(),
                modelled ? round4(fit.criticalSpeed()) : null,
                modelled ? round1(fit.criticalPaceSecondsPerKm()) : null,
                modelled ? round1(fit.dPrime()) : null,
                fit.pointsUsed(),
                modelled ? round1(fit.maxErrorPercent()) : null);
        Limits limits = new Limits((int) CriticalSpeedModel.MIN_SECONDS, (int) CriticalSpeedModel.MAX_SECONDS,
                CriticalSpeedModel.MIN_POINTS, CriticalSpeedModel.MIN_SPREAD, CriticalSpeedModel.OK_ERROR_PERCENT,
                CriticalSpeedModel.ROUGH_ERROR_PERCENT);
        return new PaceCurveResponse(today, zone.getId(), days, from, today, complete, points, model, limits);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static double round4(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}
