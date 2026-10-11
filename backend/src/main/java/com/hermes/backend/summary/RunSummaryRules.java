package com.hermes.backend.summary;

import static com.hermes.backend.summary.SummaryThresholds.DRIFT_HIGH;
import static com.hermes.backend.summary.SummaryThresholds.DRIFT_MIN_SECONDS;
import static com.hermes.backend.summary.SummaryThresholds.DRIFT_MODERATE;
import static com.hermes.backend.summary.SummaryThresholds.EASY_SHARE;
import static com.hermes.backend.summary.SummaryThresholds.EFFORT_DAYS;
import static com.hermes.backend.summary.SummaryThresholds.EFFORT_HIGH;
import static com.hermes.backend.summary.SummaryThresholds.EFFORT_LOW;
import static com.hermes.backend.summary.SummaryThresholds.FILLERS_ONLY_BELOW;
import static com.hermes.backend.summary.SummaryThresholds.FORM_BAND;
import static com.hermes.backend.summary.SummaryThresholds.FORM_MIN_SWING;
import static com.hermes.backend.summary.SummaryThresholds.GAP_NOTICEABLE_SECONDS;
import static com.hermes.backend.summary.SummaryThresholds.HARD_SHARE;
import static com.hermes.backend.summary.SummaryThresholds.HILLY_METRES_PER_KM;
import static com.hermes.backend.summary.SummaryThresholds.LONGEST_DAYS;
import static com.hermes.backend.summary.SummaryThresholds.LONGEST_MIN_KM;
import static com.hermes.backend.summary.SummaryThresholds.MAX_SUPPORTING;
import static com.hermes.backend.summary.SummaryThresholds.MIN_HARDEST_RUNS;
import static com.hermes.backend.summary.SummaryThresholds.MIN_EFFORT_RUNS;
import static com.hermes.backend.summary.SummaryThresholds.MIN_LONGEST_RUNS;
import static com.hermes.backend.summary.SummaryThresholds.MIN_PACE_RUNS;
import static com.hermes.backend.summary.SummaryThresholds.MIN_SPLITS;
import static com.hermes.backend.summary.SummaryThresholds.MIN_WORKOUT_RUNS;
import static com.hermes.backend.summary.SummaryThresholds.PACE_BAND;
import static com.hermes.backend.summary.SummaryThresholds.PACE_DAYS;
import static com.hermes.backend.summary.SummaryThresholds.SIMILAR_MAX;
import static com.hermes.backend.summary.SummaryThresholds.SIMILAR_MIN;
import static com.hermes.backend.summary.SummaryThresholds.SPLIT_BAND;
import static com.hermes.backend.summary.SummaryThresholds.VARIABLE_CV;
import static com.hermes.backend.summary.SummaryThresholds.ZONES_MIN_SECONDS;

import com.hermes.backend.summary.RunSummary.Finding;
import com.hermes.backend.summary.SummaryInputs.RecentRun;
import com.hermes.backend.summary.SummaryInputs.Run;
import com.hermes.backend.summary.SummaryInputs.Splits;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The rules of the run summary (docs/README-ANALYSIS.md, "Run Summary"). Each one reads {@link SummaryInputs} and either says
 * something it can back with numbers or says nothing: with too few runs to compare with, no heart rate, or a run whose kind
 * makes the comparison meaningless (a workout is not "steady"; a race is not compared with training), the line is simply
 * absent. Nothing is invented, nothing is a verdict: every finding carries the numbers and the thresholds it turned on.
 *
 * <p>The headline says what kind of run it was, in this order of trust: what the runner labelled it (race, workout), then
 * whether its kilometre paces vary too much to call it one steady effort, then the heart-rate zones, then the effort
 * against their usual. Lines then compare it with their recent runs (effort, pace), describe its pacing and heart rate,
 * and say how fresh they were and how hilly it was.</p>
 */
final class RunSummaryRules {

    static final String RACE = "RACE";
    static final String WORKOUT = "WORKOUT";

    private static final int HEADLINE_WEIGHT = 10;

    private RunSummaryRules() {
    }

    /** The headline, then the lines most worth saying (never more than {@link SummaryThresholds#MAX_SUPPORTING}). */
    static List<Finding> evaluate(SummaryInputs in) {
        // In this order, which is also what decides between two lines that are worth the same.
        List<Finding> lines = new ArrayList<>();
        longest(in).ifPresent(lines::add);
        effort(in).ifPresent(lines::add);
        drift(in).ifPresent(lines::add);
        shape(in).ifPresent(lines::add);
        pace(in).ifPresent(lines::add);
        form(in).ifPresent(lines::add);
        climb(in).ifPresent(lines::add);

        List<Finding> notable = new ArrayList<>(lines.stream().filter(line -> line.weight() >= 2).toList());
        notable.sort(Comparator.comparingInt(Finding::weight).reversed());
        List<Finding> shown = new ArrayList<>(notable.subList(0, Math.min(notable.size(), MAX_SUPPORTING)));
        // A run with little to say still gets a couple of lines of "as usual", so the runner can see it was looked at.
        int room = Math.min(FILLERS_ONLY_BELOW - shown.size(), MAX_SUPPORTING - shown.size());
        for (Finding line : lines) {
            if (room <= 0) {
                break;
            }
            if (line.weight() < 2) {
                shown.add(line);
                room--;
            }
        }

        List<Finding> all = new ArrayList<>();
        all.add(character(in));
        all.addAll(shown);
        return all;
    }

    // ------------------------------------------------------------------------------------------------ the headline

    static Finding character(SummaryInputs in) {
        Run run = in.run();
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("distanceKm", r2(run.distanceKm()));
        facts.put("movingSeconds", run.movingSeconds());

        if (RACE.equals(run.runType())) {
            facts.put("basis", "run_type");
            return finding("character", "race", "neutral", HEADLINE_WEIGHT, facts, Map.of());
        }
        if (WORKOUT.equals(run.runType())) {
            facts.put("basis", "run_type");
            return finding("character", "workout", "neutral", HEADLINE_WEIGHT, facts, Map.of());
        }
        if (isVariable(in.splits())) {
            List<Double> paces = in.splits().paces();
            facts.put("fastestPaceSecPerKm", r1(paces.stream().min(Double::compare).orElse(0.0)));
            facts.put("slowestPaceSecPerKm", r1(paces.stream().max(Double::compare).orElse(0.0)));
            facts.put("variationPercent", r1(variation(paces) * 100.0));
            facts.put("splits", paces.size());
            facts.put("basis", in.splits().gradeAdjusted() ? "grade_adjusted" : "pace");
            return finding("character", "changes", "neutral", HEADLINE_WEIGHT, facts, Map.of("variationPercent", pct(VARIABLE_CV), "minSplits", MIN_SPLITS));
        }
        int[] zones = run.zoneSeconds();
        int zoneTotal = zones == null ? 0 : sum(zones);
        if (zoneTotal >= ZONES_MIN_SECONDS) {
            double easy = (zones[0] + zones[1]) / (double) zoneTotal;
            double hard = (zones[3] + zones[4]) / (double) zoneTotal;
            facts.put("zonePercents", List.of(zonePercent(zones[0], zoneTotal), zonePercent(zones[1], zoneTotal), zonePercent(zones[2], zoneTotal),
                    zonePercent(zones[3], zoneTotal), zonePercent(zones[4], zoneTotal)));
            facts.put("easyPercent", (int) Math.round(easy * 100.0));
            facts.put("hardPercent", (int) Math.round(hard * 100.0));
            facts.put("heartRateMinutes", (int) Math.round(zoneTotal / 60.0));
            facts.put("basis", "zones");
            String variant = hard >= HARD_SHARE ? "hard" : easy >= EASY_SHARE ? "easy" : "moderate";
            return finding("character", variant, "neutral", HEADLINE_WEIGHT, facts,
                    Map.of("easyPercent", pct(EASY_SHARE), "hardPercent", pct(HARD_SHARE), "minHeartRateMinutes", ZONES_MIN_SECONDS / 60));
        }
        EffortContext usual = effortContext(in);
        if (usual != null && usual.median() > 0) {
            double ratio = run.effort() / usual.median();
            facts.put("effort", r1(run.effort()));
            facts.put("usualEffort", r1(usual.median()));
            facts.put("ratio", r2(ratio));
            facts.put("count", usual.count());
            facts.put("basis", "effort");
            String variant = ratio >= EFFORT_HIGH ? "hard" : ratio <= EFFORT_LOW ? "easy" : "moderate";
            return finding("character", variant, "neutral", HEADLINE_WEIGHT, facts,
                    Map.of("higherRatio", EFFORT_HIGH, "lowerRatio", EFFORT_LOW, "windowDays", EFFORT_DAYS));
        }
        return finding("character", "unclear", "neutral", HEADLINE_WEIGHT, facts, Map.of());
    }

    // ------------------------------------------------------------------------------------------------ the lines

    /** The effort against what is usual for runs of this kind (and, for runs that are not workouts, of this length). */
    static Optional<Finding> effort(SummaryInputs in) {
        EffortContext usual = effortContext(in);
        if (usual == null || usual.median() <= 0) {
            return Optional.empty();
        }
        Run run = in.run();
        double effort = run.effort();
        double ratio = effort / usual.median();
        String variant;
        int weight;
        if (effort > usual.max() && usual.count() >= MIN_HARDEST_RUNS) {
            variant = "hardest";
            weight = 3;
        } else if (ratio >= EFFORT_HIGH) {
            variant = "higher";
            weight = 2;
        } else if (ratio <= EFFORT_LOW) {
            variant = "lower";
            weight = 2;
        } else {
            variant = "typical";
            weight = 1;
        }
        boolean workout = WORKOUT.equals(run.runType());
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("effort", r1(effort));
        facts.put("usualEffort", r1(usual.median()));
        facts.put("ratio", r2(ratio));
        facts.put("count", usual.count());
        facts.put("highestBefore", r1(usual.max()));
        facts.put("windowDays", EFFORT_DAYS);
        facts.put("scope", workout ? "workouts" : "similar_length");
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("higherRatio", EFFORT_HIGH);
        rule.put("lowerRatio", EFFORT_LOW);
        rule.put("minRuns", workout ? MIN_WORKOUT_RUNS : MIN_EFFORT_RUNS);
        rule.put("recordMinRuns", MIN_HARDEST_RUNS);
        rule.put("windowDays", EFFORT_DAYS);
        if (!workout) {
            rule.put("lengthFromPercent", pct(SIMILAR_MIN));
            rule.put("lengthToPercent", pct(SIMILAR_MAX));
        }
        return Optional.of(finding("effort", variant, "neutral", weight, facts, rule));
    }

    /** The pace against the runner's recent runs of similar length, for runs that are neither workouts nor races. */
    static Optional<Finding> pace(SummaryInputs in) {
        Run run = in.run();
        if (!"N".equals(kind(run.runType())) || run.distanceKm() <= 0 || run.movingSeconds() <= 0) {
            return Optional.empty();
        }
        List<RecentRun> compared = in.before().stream()
                .filter(other -> inWindow(other.day(), run.day(), PACE_DAYS))
                .filter(other -> "N".equals(kind(other.runType())))
                .filter(other -> other.distanceKm() > 0 && other.movingSeconds() > 0)
                .filter(other -> similar(other.distanceKm(), run.distanceKm()))
                .toList();
        if (compared.size() < MIN_PACE_RUNS) {
            return Optional.empty();
        }
        double seconds = compared.stream().mapToDouble(RecentRun::movingSeconds).sum();
        double km = compared.stream().mapToDouble(RecentRun::distanceKm).sum();
        double recent = seconds / km;
        double thisPace = run.movingSeconds() / run.distanceKm();
        double delta = (thisPace - recent) / recent;
        String variant = delta <= -PACE_BAND ? "faster" : delta >= PACE_BAND ? "slower" : "similar";
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("paceSecPerKm", r1(thisPace));
        facts.put("recentPaceSecPerKm", r1(recent));
        facts.put("deltaSeconds", r1(thisPace - recent));
        facts.put("deltaPercent", r1(delta * 100.0));
        facts.put("count", compared.size());
        facts.put("windowDays", PACE_DAYS);
        facts.put("fromKm", r1(run.distanceKm() * SIMILAR_MIN));
        facts.put("toKm", r1(run.distanceKm() * SIMILAR_MAX));
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("bandPercent", pct(PACE_BAND));
        rule.put("minRuns", MIN_PACE_RUNS);
        rule.put("windowDays", PACE_DAYS);
        rule.put("lengthFromPercent", pct(SIMILAR_MIN));
        rule.put("lengthToPercent", pct(SIMILAR_MAX));
        return Optional.of(finding("pace", variant, "faster".equals(variant) ? "positive" : "neutral", "similar".equals(variant) ? 1 : 2, facts, rule));
    }

    /** How the run was paced: the second half against the first. Not for a workout, nor for a run with changes of pace. */
    static Optional<Finding> shape(SummaryInputs in) {
        Splits splits = in.splits();
        if (WORKOUT.equals(in.run().runType()) || splits == null || splits.paces().size() < MIN_SPLITS || isVariable(splits)) {
            return Optional.empty();
        }
        List<Double> paces = splits.paces();
        int half = paces.size() / 2;
        double first = mean(paces.subList(0, half));
        double second = mean(paces.subList(paces.size() - half, paces.size()));
        double delta = (second - first) / first;
        String variant = delta <= -SPLIT_BAND ? "negative" : delta >= SPLIT_BAND ? "faded" : "even";
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("firstHalfPaceSecPerKm", r1(first));
        facts.put("secondHalfPaceSecPerKm", r1(second));
        facts.put("deltaSeconds", r1(second - first));
        facts.put("deltaPercent", r1(delta * 100.0));
        facts.put("splitsPerHalf", half);
        facts.put("splits", paces.size());
        facts.put("fastestPaceSecPerKm", r1(paces.stream().min(Double::compare).orElse(0.0)));
        facts.put("slowestPaceSecPerKm", r1(paces.stream().max(Double::compare).orElse(0.0)));
        facts.put("basis", splits.gradeAdjusted() ? "grade_adjusted" : "pace");
        Map<String, Object> rule = Map.of("bandPercent", pct(SPLIT_BAND), "minSplits", MIN_SPLITS, "variationPercent", pct(VARIABLE_CV));
        String tone = "negative".equals(variant) ? "positive" : "faded".equals(variant) ? "caution" : "neutral";
        return Optional.of(finding("shape", variant, tone, "even".equals(variant) ? 1 : 2, facts, rule));
    }

    /** How much more heart rate the second half took for the same pace. Not for a workout, nor for a short run. */
    static Optional<Finding> drift(SummaryInputs in) {
        SummaryInputs.Drift drift = in.drift();
        Run run = in.run();
        if (drift == null || WORKOUT.equals(run.runType()) || run.movingSeconds() < DRIFT_MIN_SECONDS) {
            return Optional.empty();
        }
        String variant = drift.percent() > DRIFT_HIGH ? "high" : drift.percent() > DRIFT_MODERATE ? "moderate" : "low";
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("driftPercent", r1(drift.percent()));
        facts.put("firstHalfHeartRate", Math.round(drift.firstHalfHeartRate()));
        facts.put("secondHalfHeartRate", Math.round(drift.secondHalfHeartRate()));
        facts.put("minutes", (int) Math.round(run.movingSeconds() / 60.0));
        Map<String, Object> rule = Map.of("moderatePercent", DRIFT_MODERATE, "highPercent", DRIFT_HIGH, "minMinutes", DRIFT_MIN_SECONDS / 60);
        int weight = "high".equals(variant) ? 3 : "moderate".equals(variant) ? 2 : 1;
        String tone = "high".equals(variant) ? "caution" : "low".equals(variant) ? "positive" : "neutral";
        return Optional.of(finding("drift", variant, tone, weight, facts, rule));
    }

    /** How fresh the runner was going in: said only when it is clearly fresh or clearly tired (the fitness card's words). */
    static Optional<Finding> form(SummaryInputs in) {
        SummaryInputs.Form form = in.form();
        if (form == null) {
            return Optional.empty();
        }
        String variant = null;
        if (Math.abs(form.form()) >= FORM_MIN_SWING) {
            if (form.form() > form.fitness() * FORM_BAND) {
                variant = "fresh";
            } else if (form.form() < -form.fitness() * FORM_BAND) {
                variant = "tired";
            }
        }
        if (variant == null) {
            return Optional.empty();
        }
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("form", r1(form.form()));
        facts.put("fitness", r1(form.fitness()));
        facts.put("fatigue", r1(form.fatigue()));
        facts.put("day", form.day().toString());
        Map<String, Object> rule = Map.of("bandPercent", pct(FORM_BAND), "minSwing", FORM_MIN_SWING);
        return Optional.of(finding("form", variant, "tired".equals(variant) ? "caution" : "positive", 2, facts, rule));
    }

    /** A hilly run, with what the climbing cost in pace when the stream let that be worked out. */
    static Optional<Finding> climb(SummaryInputs in) {
        Run run = in.run();
        if (run.climbMetres() == null || run.distanceKm() <= 0) {
            return Optional.empty();
        }
        double perKm = run.climbMetres() / run.distanceKm();
        if (perKm < HILLY_METRES_PER_KM) {
            return Optional.empty();
        }
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("climbMetres", Math.round(run.climbMetres()));
        facts.put("metresPerKm", r1(perKm));
        Splits splits = in.splits();
        if (splits != null && splits.paceSecPerKm() != null && splits.gapSecPerKm() != null
                && splits.paceSecPerKm() - splits.gapSecPerKm() >= GAP_NOTICEABLE_SECONDS) {
            facts.put("paceSecPerKm", r1(splits.paceSecPerKm()));
            facts.put("gradeAdjustedPaceSecPerKm", r1(splits.gapSecPerKm()));
        }
        Map<String, Object> rule = Map.of("hillyMetresPerKm", HILLY_METRES_PER_KM, "paceDifferenceSeconds", GAP_NOTICEABLE_SECONDS);
        return Optional.of(finding("climb", "hilly", "neutral", 2, facts, rule));
    }

    /** The longest run of the last four weeks, when there have been enough runs in them to be the longest of. */
    static Optional<Finding> longest(SummaryInputs in) {
        Run run = in.run();
        if (WORKOUT.equals(run.runType()) || run.distanceKm() < LONGEST_MIN_KM) {
            return Optional.empty();
        }
        List<RecentRun> window = in.before().stream()
                .filter(other -> inWindow(other.day(), run.day(), LONGEST_DAYS))
                .filter(other -> !WORKOUT.equals(other.runType()))
                .toList();
        if (window.size() < MIN_LONGEST_RUNS) {
            return Optional.empty();
        }
        double previous = window.stream().mapToDouble(RecentRun::distanceKm).max().orElse(0.0);
        if (run.distanceKm() <= previous) {
            return Optional.empty();
        }
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("distanceKm", r2(run.distanceKm()));
        facts.put("previousLongestKm", r2(previous));
        facts.put("count", window.size());
        facts.put("windowDays", LONGEST_DAYS);
        Map<String, Object> rule = Map.of("windowDays", LONGEST_DAYS, "minRuns", MIN_LONGEST_RUNS, "minKm", LONGEST_MIN_KM);
        return Optional.of(finding("longest", "longest", "positive", 3, facts, rule));
    }

    // ------------------------------------------------------------------------------------------------ helpers

    /** What the effort lines compare with: the runner's earlier runs of the same kind (and length), and how many there are. */
    private record EffortContext(double median, double max, int count) {
    }

    private static EffortContext effortContext(SummaryInputs in) {
        Run run = in.run();
        if (run.effort() == null || RACE.equals(run.runType())) {
            return null;
        }
        boolean workout = WORKOUT.equals(run.runType());
        List<Double> efforts = in.before().stream()
                .filter(other -> inWindow(other.day(), run.day(), EFFORT_DAYS))
                .filter(other -> kind(other.runType()).equals(kind(run.runType())))
                .filter(other -> other.effort() != null && other.effort() > 0)
                .filter(other -> workout || similar(other.distanceKm(), run.distanceKm()))
                .map(RecentRun::effort)
                .sorted()
                .toList();
        if (efforts.size() < (workout ? MIN_WORKOUT_RUNS : MIN_EFFORT_RUNS)) {
            return null;
        }
        return new EffortContext(median(efforts), efforts.get(efforts.size() - 1), efforts.size());
    }

    /** Races, workouts and everything else are compared with their own kind only. */
    static String kind(String runType) {
        return RACE.equals(runType) ? "R" : WORKOUT.equals(runType) ? "W" : "N";
    }

    /** Whether an earlier run's day is in the {@code days} days before the run's day (the run's own day is not). */
    private static boolean inWindow(LocalDate day, LocalDate runDay, int days) {
        return day != null && day.isBefore(runDay) && !day.isBefore(runDay.minusDays(days));
    }

    private static boolean similar(double km, double referenceKm) {
        return km >= referenceKm * SIMILAR_MIN && km <= referenceKm * SIMILAR_MAX;
    }

    /** Whether the kilometre paces vary too much to call the run one steady effort. */
    static boolean isVariable(Splits splits) {
        return splits != null && splits.paces().size() >= MIN_SPLITS && variation(splits.paces()) > VARIABLE_CV;
    }

    /** The standard deviation of the paces over their mean. */
    static double variation(List<Double> paces) {
        double mean = mean(paces);
        if (mean <= 0) {
            return 0;
        }
        double squares = 0;
        for (double pace : paces) {
            squares += (pace - mean) * (pace - mean);
        }
        return Math.sqrt(squares / paces.size()) / mean;
    }

    private static double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    /** The median of values already in order. */
    private static double median(List<Double> sorted) {
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static int sum(int[] values) {
        int total = 0;
        for (int value : values) {
            total += value;
        }
        return total;
    }

    private static int zonePercent(int seconds, int total) {
        return (int) Math.round(seconds * 100.0 / total);
    }

    private static int pct(double share) {
        return (int) Math.round(share * 100.0);
    }

    private static double r1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static double r2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static Finding finding(String id, String variant, String tone, int weight, Map<String, Object> facts, Map<String, Object> thresholds) {
        return new Finding(id, variant, tone, weight, facts, thresholds);
    }
}
