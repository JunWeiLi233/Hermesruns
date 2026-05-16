package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class WeeklyDigestService {
    private static final int VDOT_TOP_N = 3;
    private static final double VDOT_MIN_KM_STRICT = 3.0;
    private static final double VDOT_MIN_KM_LOOSE = 1.5;
    private static final double NO_HR_MAX_PACE_SLOP_FACTOR = 1.18;

    private final ActivityRepository activityRepository;
    private final ReadinessService readinessService;
    private Clock clock;

    @Autowired
    public WeeklyDigestService(ActivityRepository activityRepository, ReadinessService readinessService) {
        this.activityRepository = activityRepository;
        this.readinessService = readinessService;
        this.clock = Clock.systemDefaultZone();
    }

    void setClockForTests(Clock clock) {
        this.clock = clock == null ? Clock.systemDefaultZone() : clock;
    }

    public WeeklyDigestResponse buildDigest(Runner runner) {
        LocalDate today = LocalDate.now(clock);
        LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        LocalDate weekStart = currentWeekStart.minusWeeks(1);
        LocalDate weekEnd = currentWeekStart.minusDays(1);
        LocalDate priorWeekStart = weekStart.minusWeeks(1);

        List<Activity> digestWeekRuns = findRuns(runner, weekStart, currentWeekStart);
        List<Activity> priorWeekRuns = findRuns(runner, priorWeekStart, weekStart);

        TrainingSummary summary = summarize(weekStart, weekEnd, digestWeekRuns);
        VdotTrend vdotTrend = buildVdotTrend(digestWeekRuns, priorWeekRuns);
        WellnessTrend wellnessTrend = buildWellnessTrend(runner, weekStart, currentWeekStart, priorWeekStart);
        CoachFocus coachFocus = selectCoachFocus(summary, vdotTrend, wellnessTrend);

        return new WeeklyDigestResponse(
                weekStart,
                weekEnd,
                summary,
                vdotTrend,
                wellnessTrend,
                coachFocus
        );
    }

    private List<Activity> findRuns(Runner runner, LocalDate fromInclusive, LocalDate toExclusive) {
        return activityRepository.findRunsBetween(
                runner,
                ActivityType.RUN,
                fromInclusive.atStartOfDay(),
                toExclusive.atStartOfDay()
        );
    }

    private TrainingSummary summarize(LocalDate weekStart, LocalDate weekEnd, List<Activity> runs) {
        List<Activity> safeRuns = runs == null ? List.of() : runs;
        double totalDistanceKm = safeRuns.stream().mapToDouble(this::distanceKm).sum();
        long totalDurationSeconds = safeRuns.stream().mapToLong(this::durationSeconds).sum();
        double longRunKm = safeRuns.stream().mapToDouble(this::distanceKm).max().orElse(0);
        Double averagePaceSecPerKm = totalDistanceKm > 0 && totalDurationSeconds > 0
                ? round1(totalDurationSeconds / totalDistanceKm)
                : null;

        return new TrainingSummary(
                weekStart,
                weekEnd,
                safeRuns.size(),
                round1(totalDistanceKm),
                totalDurationSeconds,
                round1(longRunKm),
                averagePaceSecPerKm
        );
    }

    private VdotTrend buildVdotTrend(List<Activity> digestWeekRuns, List<Activity> priorWeekRuns) {
        List<Activity> combined = java.util.stream.Stream.concat(
                (digestWeekRuns == null ? List.<Activity>of() : digestWeekRuns).stream(),
                (priorWeekRuns == null ? List.<Activity>of() : priorWeekRuns).stream()
        ).toList();
        RunStats stats = precomputeRunStats(combined);
        RepresentativeVdot current = representativeVdot(digestWeekRuns, stats);
        RepresentativeVdot previous = representativeVdot(priorWeekRuns, stats);

        if (current.value() <= 0 || previous.value() <= 0) {
            return new VdotTrend(current.valueOrNull(), previous.valueOrNull(), null, "maintaining", false);
        }

        double delta = round1(current.value() - previous.value());
        String direction = "maintaining";
        if (delta >= 0.8) {
            direction = "improving";
        } else if (delta <= -0.8) {
            direction = "declining";
        }
        return new VdotTrend(current.value(), previous.value(), delta, direction, true);
    }

    private WellnessTrend buildWellnessTrend(Runner runner, LocalDate weekStart, LocalDate currentWeekStart, LocalDate priorWeekStart) {
        List<ReadinessService.ReadinessDay> current = readinessForDates(runner, weekStart, currentWeekStart);
        List<ReadinessService.ReadinessDay> previous = readinessForDates(runner, priorWeekStart, weekStart);

        Double currentAverage = averageReadiness(current);
        Double previousAverage = averageReadiness(previous);
        if (currentAverage == null || previousAverage == null) {
            return new WellnessTrend(currentAverage, previousAverage, null, "unknown", false);
        }

        double delta = round1(currentAverage - previousAverage);
        String direction = "steady";
        if (delta >= 4.0) {
            direction = "improving";
        } else if (delta <= -4.0) {
            direction = "declining";
        }
        return new WellnessTrend(currentAverage, previousAverage, delta, direction, true);
    }

    private List<ReadinessService.ReadinessDay> readinessForDates(Runner runner, LocalDate fromInclusive, LocalDate toExclusive) {
        return fromInclusive.datesUntil(toExclusive)
                .map(date -> readinessService.getDailyReadiness(runner, date))
                .filter(Objects::nonNull)
                .toList();
    }

    private Double averageReadiness(List<ReadinessService.ReadinessDay> days) {
        List<ReadinessService.ReadinessDay> measuredDays = (days == null ? List.<ReadinessService.ReadinessDay>of() : days).stream()
                .filter(ReadinessService.ReadinessDay::hasData)
                .toList();
        if (measuredDays.isEmpty()) {
            return null;
        }
        return round1(measuredDays.stream().mapToInt(ReadinessService.ReadinessDay::score).average().orElse(0));
    }

    private CoachFocus selectCoachFocus(TrainingSummary summary, VdotTrend vdotTrend, WellnessTrend wellnessTrend) {
        if (wellnessTrend.hasData() && "declining".equals(wellnessTrend.direction())) {
            return new CoachFocus(
                    "protect_recovery",
                    "Protect recovery first",
                    "Your readiness slipped last week, so keep the next quality day controlled until sleep, HRV, and resting HR settle."
            );
        }
        if (vdotTrend.hasData() && "declining".equals(vdotTrend.direction())) {
            return new CoachFocus(
                    "restore_aerobic_control",
                    "Restore aerobic control",
                    "Your VDOT trend dipped; make the next focus a relaxed aerobic run with a smooth finish instead of chasing pace early."
            );
        }
        if (summary.runCount() < 3) {
            return new CoachFocus(
                    "build_consistency",
                    "Build consistency",
                    "The biggest gain is one more easy run next week, keeping the total load boring and repeatable."
            );
        }
        if (summary.longRunKm() >= Math.max(8.0, summary.totalDistanceKm() * 0.45)) {
            return new CoachFocus(
                    "balance_long_run",
                    "Balance the long run",
                    "Your longest run carried a big share of the week, so spread easy volume more evenly before adding another push."
            );
        }
        return new CoachFocus(
                "extend_aerobic_base",
                "Extend the aerobic base",
                "You have enough consistency to add a little controlled aerobic volume while keeping the hard work precise."
        );
    }

    private RepresentativeVdot representativeVdot(List<Activity> runs, RunStats stats) {
        List<VdotEntry> entries = (runs == null ? List.<Activity>of() : runs).stream()
                .map(run -> buildVdotEntry(run, stats))
                .filter(Objects::nonNull)
                .toList();
        if (entries.isEmpty()) {
            return new RepresentativeVdot(0);
        }

        List<VdotEntry> strict = entries.stream()
                .filter(entry -> entry.distanceKm() >= VDOT_MIN_KM_STRICT)
                .toList();
        List<VdotEntry> pool = strict.isEmpty() ? entries : strict;
        List<VdotEntry> sorted = pool.stream()
                .sorted(Comparator.comparingDouble(VdotEntry::vo2max).reversed())
                .limit(VDOT_TOP_N)
                .toList();
        double average = sorted.stream().mapToDouble(VdotEntry::vo2max).average().orElse(0);
        return new RepresentativeVdot(round1(average));
    }

    private VdotEntry buildVdotEntry(Activity run, RunStats stats) {
        double km = distanceKm(run);
        long seconds = durationSeconds(run);
        if (km < VDOT_MIN_KM_LOOSE || seconds <= 0) {
            return null;
        }

        double timeMinutes = seconds / 60.0;
        double velocityMPerMin = (km * 1000.0) / timeMinutes;
        double vo2Cost = danielsRunningVo2CostMlKgMin(velocityMPerMin);
        double paceSecPerKm = seconds / km;
        Double averageHeartRate = run.getAverageHeartRate();

        if (averageHeartRate != null && averageHeartRate > 40 && stats.hrMax() >= 130) {
            double fraction = fractionVo2maxFromHeartRate(averageHeartRate, stats.hrMax());
            return new VdotEntry(clampVo2maxEstimate(vo2Cost / fraction), km);
        }

        if (stats.medianPaceSecPerKm() != null
                && paceSecPerKm > stats.medianPaceSecPerKm() * NO_HR_MAX_PACE_SLOP_FACTOR) {
            return null;
        }

        double raw = estimateVo2maxDanielsRaceMlKgMin(km * 1000.0, timeMinutes);
        return raw > 0 ? new VdotEntry(clampVo2maxEstimate(raw), km) : null;
    }

    private RunStats precomputeRunStats(List<Activity> runs) {
        List<Activity> safeRuns = runs == null ? List.of() : runs;
        double hrMax = safeRuns.stream()
                .map(Activity::getMaxHeartRate)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .max()
                .orElse(0);
        List<Double> paces = safeRuns.stream()
                .map(run -> {
                    double km = distanceKm(run);
                    long seconds = durationSeconds(run);
                    return km >= VDOT_MIN_KM_LOOSE && seconds > 0 ? seconds / km : null;
                })
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        Double medianPace = paces.isEmpty() ? null : paces.get(paces.size() / 2);
        return new RunStats(hrMax >= 130 ? hrMax : 0, medianPace);
    }

    private double distanceKm(Activity activity) {
        if (activity == null) {
            return 0;
        }
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        Double meters = activity.getDistanceMeters();
        return meters != null && meters > 0 ? meters / 1000.0 : 0;
    }

    private long durationSeconds(Activity activity) {
        if (activity == null) {
            return 0;
        }
        if (activity.getMovingTimeSeconds() > 0) {
            return activity.getMovingTimeSeconds();
        }
        Long duration = activity.getDurationSeconds();
        return duration != null && duration > 0 ? duration : 0;
    }

    private double danielsRunningVo2CostMlKgMin(double velocityMPerMin) {
        if (velocityMPerMin <= 0) {
            return 0;
        }
        return -4.60 + 0.182258 * velocityMPerMin + 0.000104 * velocityMPerMin * velocityMPerMin;
    }

    private double danielsFractionOfVo2maxAtDurationMinutes(double timeMinutes) {
        if (timeMinutes <= 0) {
            return 0;
        }
        return 0.8
                + 0.1894393 * Math.exp(-0.012778 * timeMinutes)
                + 0.2989558 * Math.exp(-0.1932605 * timeMinutes);
    }

    private double estimateVo2maxDanielsRaceMlKgMin(double distanceMeters, double timeMinutes) {
        if (distanceMeters <= 0 || timeMinutes <= 0) {
            return 0;
        }
        double velocity = distanceMeters / timeMinutes;
        double vo2 = danielsRunningVo2CostMlKgMin(velocity);
        double fraction = danielsFractionOfVo2maxAtDurationMinutes(timeMinutes);
        return fraction > 0 ? vo2 / fraction : 0;
    }

    private double fractionVo2maxFromHeartRate(double averageHeartRate, double hrMax) {
        double hrPercent = Math.min(1.0, averageHeartRate / hrMax);
        return Math.min(0.98, Math.max(0.60, hrPercent));
    }

    private double clampVo2maxEstimate(double value) {
        if (!Double.isFinite(value) || value <= 0) {
            return 0;
        }
        return Math.min(88, Math.max(24, value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    public record WeeklyDigestResponse(
            LocalDate weekStart,
            LocalDate weekEnd,
            TrainingSummary trainingSummary,
            VdotTrend vdot,
            WellnessTrend wellnessTrend,
            CoachFocus coachFocus
    ) {}

    public record TrainingSummary(
            LocalDate weekStart,
            LocalDate weekEnd,
            int runCount,
            double totalDistanceKm,
            long totalDurationSeconds,
            double longRunKm,
            Double averagePaceSecPerKm
    ) {}

    public record VdotTrend(Double current, Double previous, Double delta, String direction, boolean hasData) {}

    public record WellnessTrend(Double currentAverage, Double previousAverage, Double delta, String direction, boolean hasData) {}

    public record CoachFocus(String key, String title, String message) {
        public CoachFocus {
            key = normalizeToken(key);
        }
    }

    private record RunStats(double hrMax, Double medianPaceSecPerKm) {}

    private record VdotEntry(double vo2max, double distanceKm) {}

    private record RepresentativeVdot(double value) {
        Double valueOrNull() {
            return value > 0 ? value : null;
        }
    }

    private static String normalizeToken(String value) {
        if (value == null || value.isBlank()) {
            return "weekly_focus";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
