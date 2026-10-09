package com.hermes.backend.coaching;

import com.hermes.backend.runner.HeartRateZones;

/**
 * The effort score of one run: a single number for how hard it was, built from the best evidence there is.
 *
 * <p>In order of preference, and recorded as the score's source so the number can be explained:</p>
 * <ol>
 *   <li>{@link #HR_ZONES}: the heart-rate stream, as weighted minutes in zones (see {@link HrZoneAnalysis}).
 *       Used when the samples cover at least half of the moving time; the score is scaled up to the whole run.</li>
 *   <li>{@link #PERCEIVED}: the runner's own 1 to 10 rating. Minutes times a weight that runs from 1 (rating 1)
 *       to 5 (rating 10), the same scale as the zone weights.</li>
 *   <li>{@link #HR_AVERAGE}: only the run's average heart rate is known; all the moving minutes are counted at
 *       the weight of the zone that average falls in. Crude for interval sessions.</li>
 *   <li>{@link #PACE_MODEL} / {@link #PACE_CALIBRATED}: no heart rate and no rating, so the pace model the
 *       coach already uses ({@link TrainingLoadAnalyzer#loadUnits}). When the runner has enough runs with both
 *       a heart-rate score and a pace-model score, the pace score is scaled onto the heart-rate scale.</li>
 * </ol>
 *
 * <p>The unit is arbitrary, like any training-load number: one hour at the middle of zone 3 scores 180.</p>
 */
final class EffortModel {

    static final String HR_ZONES = "HR_ZONES";
    static final String PERCEIVED = "PERCEIVED";
    static final String HR_AVERAGE = "HR_AVERAGE";
    static final String PACE_MODEL = "PACE_MODEL";
    static final String PACE_CALIBRATED = "PACE_CALIBRATED";

    /** Heart-rate samples have to cover at least this share of the moving time to be trusted. */
    static final double MIN_HR_COVERAGE = 0.5;
    /** Samples covering less than this many seconds are noise, whatever the coverage. */
    static final double MIN_HR_SECONDS = 60;

    /** The pace model is only scaled once this many runs have both a heart-rate and a pace score. */
    static final int MIN_CALIBRATION_RUNS = 10;
    static final double MIN_CALIBRATION_SCALE = 0.5;
    static final double MAX_CALIBRATION_SCALE = 10.0;

    private EffortModel() {
    }

    /**
     * @param movingSeconds      moving time, or zero when unknown
     * @param distanceKm         distance, or zero when unknown
     * @param perceivedExertion  the runner's 1 to 10 rating, or null
     * @param averageHeartRate   the run's average heart rate, or null
     * @param hr                 the heart-rate stream analysis; {@link HrZoneAnalysis.Result#empty()} when there is none
     * @param zones              the zones in force
     * @param calibrationScale   the factor that puts the pace model on the heart-rate scale, or null
     */
    record Input(double movingSeconds, double distanceKm, Integer perceivedExertion, Double averageHeartRate,
                 HrZoneAnalysis.Result hr, HeartRateZones zones, Double calibrationScale) {
    }

    /**
     * @param score       the effort score, or null when there is nothing to base one on
     * @param source      one of the source constants, or null when {@code score} is null
     * @param hrEffort    the heart-rate score if the stream allows one, whichever source won
     * @param paceEffort  the pace-model score if distance and time are known, whichever source won
     */
    record Result(Double score, String source, Double hrEffort, Double paceEffort) {
    }

    static Result compute(Input in) {
        double movingMinutes = in.movingSeconds() / 60.0;
        Double paceEffort = in.distanceKm() > 0 && in.movingSeconds() > 0
                ? round1(TrainingLoadAnalyzer.loadUnits(in.distanceKm(), Math.round(in.movingSeconds())))
                : null;

        Double hrEffort = hrEffort(in);
        if (hrEffort != null) {
            return new Result(hrEffort, HR_ZONES, hrEffort, paceEffort);
        }
        if (validRating(in.perceivedExertion()) && movingMinutes > 0) {
            double score = round1(movingMinutes * ratingWeight(in.perceivedExertion()));
            return new Result(score, PERCEIVED, null, paceEffort);
        }
        Double averageEffort = averageHeartRateEffort(in, movingMinutes);
        if (averageEffort != null) {
            return new Result(averageEffort, HR_AVERAGE, null, paceEffort);
        }
        if (paceEffort != null) {
            if (in.calibrationScale() != null) {
                return new Result(round1(paceEffort * in.calibrationScale()), PACE_CALIBRATED, null, paceEffort);
            }
            return new Result(paceEffort, PACE_MODEL, null, paceEffort);
        }
        return new Result(null, null, null, null);
    }

    /** The heart-rate score, or null when the stream is missing or too thin to rely on. */
    private static Double hrEffort(Input in) {
        HrZoneAnalysis.Result hr = in.hr();
        if (hr == null || hr.coveredSeconds() < MIN_HR_SECONDS) {
            return null;
        }
        double coverage = in.movingSeconds() > 0 ? Math.min(1.0, hr.coveredSeconds() / in.movingSeconds()) : 1.0;
        if (coverage < MIN_HR_COVERAGE || hr.weightedMinutes() <= 0) {
            // A stream that never rises above the effort floor is a strap reading nonsense, not an easy run.
            return null;
        }
        return round1(hr.weightedMinutes() / coverage);
    }

    private static Double averageHeartRateEffort(Input in, double movingMinutes) {
        Double average = in.averageHeartRate();
        if (average == null || movingMinutes <= 0) {
            return null;
        }
        int bpm = (int) Math.round(average);
        if (bpm < HrZoneAnalysis.MIN_VALID_BPM || bpm > HrZoneAnalysis.MAX_VALID_BPM || bpm < in.zones().effortFloorBpm()) {
            return null;
        }
        return round1(movingMinutes * (in.zones().zoneIndexFor(bpm) + 1));
    }

    static boolean validRating(Integer rating) {
        return rating != null && rating >= 1 && rating <= 10;
    }

    /** Rating 1 weighs 1, rating 10 weighs 5, evenly in between. */
    static double ratingWeight(int rating) {
        return 1.0 + (rating - 1) * 4.0 / 9.0;
    }

    /**
     * The factor that turns pace-model scores into heart-rate-scale scores: the least-squares fit of
     * {@code hrEffort = scale * paceEffort} through the origin over runs that have both, or null when there
     * are too few such runs to trust.
     *
     * @param runs            how many runs have both scores
     * @param sumHrTimesPace  sum over those runs of hrEffort * paceEffort
     * @param sumPaceSquared  sum over those runs of paceEffort squared
     */
    static Double calibrationScale(long runs, double sumHrTimesPace, double sumPaceSquared) {
        if (runs < MIN_CALIBRATION_RUNS || sumPaceSquared <= 0 || sumHrTimesPace <= 0) {
            return null;
        }
        double scale = sumHrTimesPace / sumPaceSquared;
        return Math.max(MIN_CALIBRATION_SCALE, Math.min(MAX_CALIBRATION_SCALE, scale));
    }

    static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
