package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Polarized (80/20) automated coach: rolling aggregates, schedule mutation, grey-zone feedback,
 * readiness gate, and progressive long-run blocks.
 */
@Service
public class AutomatedCoachService {

    private static final Logger log = LoggerFactory.getLogger(AutomatedCoachService.class);

    private static final double HIGH_INTENSITY_WEEKLY_CAP = 0.20;
    private static final double HIGH_MILEAGE_KM_28D = 200.0;
    private static final double RHR_STRESS_MULTIPLIER = 1.05;
    private static final double LONG_RUN_WEEKLY_BUMP = 1.12;
    private static final int SCHEDULE_HORIZON_DAYS = 14;
    private static final int SCHEDULE_ROUTE_ACTIVITY_LIMIT = 18;
    private static final double ROUTE_CLUSTER_RADIUS_METERS = 900.0;
    private static final int ROUTE_PREVIEW_POINT_LIMIT = 40;
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final CoachRunnerStateRepository coachRunnerStateRepository;
    private final CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;
    private final CoachTrainingBlockRepository coachTrainingBlockRepository;
    private final CoachFeedbackAlertRepository coachFeedbackAlertRepository;

    public AutomatedCoachService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
            CoachTrainingBlockRepository coachTrainingBlockRepository,
            CoachFeedbackAlertRepository coachFeedbackAlertRepository
    ) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.coachRunnerStateRepository = coachRunnerStateRepository;
        this.coachScheduledWorkoutRepository = coachScheduledWorkoutRepository;
        this.coachTrainingBlockRepository = coachTrainingBlockRepository;
        this.coachFeedbackAlertRepository = coachFeedbackAlertRepository;
    }

    @Transactional
    public void handleActivityIngested(Long runnerId, Long activityId) {
        Optional<Runner> runnerOpt = runnerRepository.findById(runnerId);
        if (runnerOpt.isEmpty()) {
            return;
        }
        Runner runner = runnerOpt.get();
        Optional<Activity> activityOpt = activityRepository.findById(activityId);
        if (activityOpt.isEmpty() || activityOpt.get().getActivityType() != ActivityType.RUN) {
            return;
        }
        Activity activity = activityOpt.get();
        if (activity.getRunner() == null || !activity.getRunner().getId().equals(runnerId)) {
            return;
        }

        aggregateState(runner);
        checkGreyZoneFeedback(runner, activity);
        ensureScheduleHorizon(runner, SCHEDULE_HORIZON_DAYS);
    }

    @Transactional
    public void reaggregateRunner(Long runnerId) {
        runnerRepository.findById(runnerId).ifPresent(this::aggregateState);
    }

    @Transactional
    public void nightlyAuditAllRunners() {
        List<Long> ids = activityRepository.findDistinctRunnerIdsWithActivityType(ActivityType.RUN);
        List<Runner> runners = runnerRepository.findAllById(ids);
        for (Runner runner : runners) {
            if (runner.isDeleted()) {
                continue;
            }
            try {
                aggregateState(runner);
                coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> {
                    maybeAdvanceTrainingWeek(runner, b);
                });
                apply8020ToTomorrow(runner);
                ensureScheduleHorizon(runner, SCHEDULE_HORIZON_DAYS);
            } catch (Exception e) {
                log.warn("Coach nightly audit failed for runner {}: {}", runner.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public CoachStateDto getCoachState(Runner runner) {
        CoachRunnerState state = getOrCreateState(runner);
        if (state.getLastAggregatedAt() == null) {
            aggregateState(runner);
            state = coachRunnerStateRepository.findByRunner(runner).orElse(state);
        }
        ensureScheduleHorizon(runner, SCHEDULE_HORIZON_DAYS);
        CoachScheduledWorkout todayWorkout = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDate(runner, LocalDate.now())
                .orElse(null);
        return toStateDto(runner, state, todayWorkout);
    }

    @Transactional
    public List<CoachScheduledWorkoutDto> getSchedule(Runner runner, int days) {
        int d = Math.min(28, Math.max(1, days));
        ensureScheduleHorizon(runner, Math.max(d, SCHEDULE_HORIZON_DAYS));
        LocalDate today = LocalDate.now();
        List<CoachScheduledWorkout> rows = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, today.plusDays(d - 1L));
        return rows.stream().map(AutomatedCoachService::toScheduledDto).toList();
    }

    @Transactional
    public CoachTodayDto getTodayWithReadiness(Runner runner) {
        ensureScheduleHorizon(runner, SCHEDULE_HORIZON_DAYS);
        CoachRunnerState state = getOrCreateState(runner);
        LocalDate today = LocalDate.now();
        LocalDate horizonEnd = today.plusDays(SCHEDULE_HORIZON_DAYS - 1L);
        List<CoachScheduledWorkout> rows = new ArrayList<>(coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, horizonEnd));
        CoachScheduledWorkout row = rows.stream()
                .filter(existing -> today.equals(existing.getScheduledDate()))
                .findFirst()
                .orElseGet(() -> {
                    CoachScheduledWorkout w = buildDefaultDay(runner, today, state);
                    coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> applyBlockLongRun(b, w, today));
                    CoachScheduledWorkout saved = coachScheduledWorkoutRepository.save(w);
                    rows.add(0, saved);
                    return saved;
                });
        CoachScheduledWorkout adjusted = applyReadinessGate(runner, state, row);
        CoachRouteRecommendationDto routeRecommendation = buildRouteRecommendation(runner, adjusted, rows);
        return new CoachTodayDto(toScheduledDto(adjusted), toStateDto(runner, state, adjusted), routeRecommendation);
    }

    @Transactional
    public void logRecoveryMetrics(Runner runner, Integer restingHr, Integer sleepScore, Integer hrvMs) {
        CoachRunnerState state = getOrCreateState(runner);
        if (restingHr != null && restingHr > 30 && restingHr < 120) {
            state.setLastNightRestingHr(restingHr);
            if (state.getBaselineRestingHr() == null && runner.getRestingHeartRateBpm() != null) {
                state.setBaselineRestingHr(runner.getRestingHeartRateBpm());
            }
            if (state.getBaselineRestingHr() == null) {
                state.setBaselineRestingHr(restingHr);
            }
        }
        if (sleepScore != null && sleepScore >= 0 && sleepScore <= 100) {
            state.setLastSleepScore(sleepScore);
        }
        if (hrvMs != null && hrvMs >= 0 && hrvMs < 5000) {
            state.setLastHrvMs(hrvMs);
        }
        state.setLastRecoveryLoggedAt(LocalDateTime.now());
        coachRunnerStateRepository.save(state);
    }

    @Transactional
    public void updateCoachProfile(Runner runner, Integer maxHr, Integer restingHr) {
        if (maxHr != null) {
            if (maxHr < 120 || maxHr > 230) {
                throw new IllegalArgumentException("maxHeartRateBpm out of range.");
            }
            runner.setMaxHeartRateBpm(maxHr);
        }
        if (restingHr != null) {
            if (restingHr < 30 || restingHr > 120) {
                throw new IllegalArgumentException("restingHeartRateBpm out of range.");
            }
            runner.setRestingHeartRateBpm(restingHr);
            CoachRunnerState state = getOrCreateState(runner);
            if (state.getBaselineRestingHr() == null) {
                state.setBaselineRestingHr(restingHr);
                coachRunnerStateRepository.save(state);
            }
        }
        runnerRepository.save(runner);
    }

    @Transactional
    public CoachTrainingBlock startTrainingBlock(Runner runner, double raceDistanceKm, LocalDate targetRaceDate, String name) {
        coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> {
            b.setActive(false);
            coachTrainingBlockRepository.save(b);
        });
        LocalDate today = LocalDate.now();
        double seedLong = estimateSeedLongRunKm(runner);
        CoachTrainingBlock block = new CoachTrainingBlock();
        block.setRunner(runner);
        block.setActive(true);
        block.setRaceDistanceKm(raceDistanceKm);
        block.setTargetRaceDate(targetRaceDate);
        block.setName(name != null && !name.isBlank() ? name.trim().substring(0, Math.min(120, name.length())) : "Race block");
        block.setWeekIndex(0);
        block.setCurrentLongRunKm(seedLong);
        block.setBlockStartedOn(today);
        block.setLastProgressionWeekStart(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)));
        CoachTrainingBlock saved = coachTrainingBlockRepository.save(block);
        ensureScheduleHorizon(runner, SCHEDULE_HORIZON_DAYS);
        return saved;
    }

    @Transactional
    public void stopTrainingBlock(Runner runner) {
        coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> {
            b.setActive(false);
            coachTrainingBlockRepository.save(b);
        });
    }

    @Transactional
    public List<CoachFeedbackAlertDto> listAlerts(Runner runner) {
        return coachFeedbackAlertRepository.findByRunnerAndDismissedFalseOrderByCreatedAtDesc(runner).stream()
                .map(a -> new CoachFeedbackAlertDto(a.getId(), a.getAlertType(), a.getMessage(), a.getCreatedAt()))
                .toList();
    }

    @Transactional
    public boolean dismissAlert(Runner runner, Long alertId) {
        Optional<CoachFeedbackAlert> opt = coachFeedbackAlertRepository.findByIdAndRunner(alertId, runner);
        if (opt.isEmpty()) {
            return false;
        }
        CoachFeedbackAlert a = opt.get();
        a.setDismissed(true);
        coachFeedbackAlertRepository.save(a);
        return true;
    }

    // --- internals ---

    private void aggregateState(Runner runner) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from7 = now.minusDays(7);
        LocalDateTime from28 = now.minusDays(28);
        LocalDateTime from90 = now.minusDays(90);

        // One lightweight query for 90d, then single-pass derive 28d/7d metrics in memory.
        List<RunMetricsProjection> runs90 = activityRepository.findRunMetricsBetween(runner, ActivityType.RUN, from90, now);
        double hrMax = resolveHrMax(runner, runs90);

        int low = 0;
        int grey = 0;
        int high = 0;
        int unknown = 0;
        double vol7 = 0;
        double vol28 = 0;
        for (RunMetricsProjection a : runs90) {
            LocalDateTime ts = a.getEffectiveStartTime();
            if (ts == null) {
                continue;
            }
            if (!ts.isBefore(from28)) {
                vol28 += distanceKm(a);
            }
            if (ts.isBefore(from7)) {
                continue;
            }
            vol7 += distanceKm(a);
            int mins = movingMinutes(a);
            CoachHrBand band = CoachHrZoneClassifier.classify(a.getAverageHeartRate(), hrMax);
            switch (band) {
                case LOW -> low += mins;
                case GREY -> grey += mins;
                case HIGH -> high += mins;
                case UNKNOWN -> unknown += mins;
            }
        }

        int tracked = low + grey + high;
        Double ratio = tracked > 0 ? (high / (double) tracked) : null;

        CoachRunnerState state = getOrCreateState(runner);
        state.setVolumeKm7d(vol7);
        state.setVolumeKm28d(vol28);
        state.setMinutesLowZ1Z2Last7d(low);
        state.setMinutesGreyZ3Last7d(grey);
        state.setMinutesHighZ4Z5Last7d(high);
        state.setMinutesUnknownHrLast7d(unknown);
        state.setHighIntensityRatioLast7d(ratio);
        state.setHighMileageGrinder(vol28 >= HIGH_MILEAGE_KM_28D);
        state.setEstimatedHrMaxBpm(hrMax);
        state.setLastAggregatedAt(now);
        coachRunnerStateRepository.save(state);
    }

    private void maybeAdvanceTrainingWeek(Runner runner, CoachTrainingBlock block) {
        LocalDate today = LocalDate.now();
        LocalDate thisMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate last = block.getLastProgressionWeekStart();
        if (last == null) {
            block.setLastProgressionWeekStart(thisMonday);
            coachTrainingBlockRepository.save(block);
            return;
        }
        if (!last.isBefore(thisMonday)) {
            return;
        }
        double next = block.getCurrentLongRunKm() * LONG_RUN_WEEKLY_BUMP;
        double maxBump = block.getCurrentLongRunKm() * 1.15;
        block.setCurrentLongRunKm(Math.min(next, maxBump));
        block.setWeekIndex(block.getWeekIndex() + 1);
        block.setLastProgressionWeekStart(thisMonday);
        coachTrainingBlockRepository.save(block);
        log.debug("Coach: advanced training week for runner {} — long run now {} km", runner.getId(), block.getCurrentLongRunKm());
    }

    private void apply8020ToTomorrow(Runner runner) {
        CoachRunnerState state = coachRunnerStateRepository.findByRunner(runner).orElse(null);
        if (state == null) {
            return;
        }
        Double ratio = state.getHighIntensityRatioLast7d();
        if (ratio == null || ratio <= HIGH_INTENSITY_WEEKLY_CAP) {
            return;
        }
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        Optional<CoachScheduledWorkout> opt = coachScheduledWorkoutRepository.findByRunnerAndScheduledDate(runner, tomorrow);
        if (opt.isEmpty()) {
            return;
        }
        CoachScheduledWorkout w = opt.get();
        if (!isHighIntensityPlanned(w.getWorkoutType())) {
            return;
        }
        CoachWorkoutType was = w.getWorkoutType();
        w.setMutatedFrom(was);
        w.setWorkoutType(CoachWorkoutType.RECOVERY);
        double prevKm = w.getPlannedDistanceKm() != null ? w.getPlannedDistanceKm() : 8.0;
        w.setPlannedDistanceKm(Math.min(8.0, prevKm));
        w.setStridesSuggested(false);
        w.setNotes("80/20 audit: recent high-intensity share is "
                + String.format("%.0f%%", ratio * 100)
                + ". This session was downgraded to an easy recovery run.");
        coachScheduledWorkoutRepository.save(w);
    }

    private CoachScheduledWorkout applyReadinessGate(Runner runner, CoachRunnerState state, CoachScheduledWorkout w) {
        Integer baseline = state.getBaselineRestingHr() != null ? state.getBaselineRestingHr() : runner.getRestingHeartRateBpm();
        Integer lastRhr = state.getLastNightRestingHr();
        if (baseline == null || lastRhr == null || baseline <= 0) {
            return w;
        }
        if (lastRhr <= baseline * RHR_STRESS_MULTIPLIER) {
            return w;
        }
        if (!isHighIntensityPlanned(w.getWorkoutType())) {
            return w;
        }
        CoachWorkoutType orig = w.getWorkoutType();
        w.setMutatedFrom(orig);
        w.setWorkoutType(CoachWorkoutType.REST);
        w.setPlannedDistanceKm(null);
        w.setStridesSuggested(false);
        w.setReadinessAdjusted(true);
        w.setNotes("Readiness: resting HR elevated vs baseline — replaced hard session with rest or cross-training.");
        return coachScheduledWorkoutRepository.save(w);
    }

    private void checkGreyZoneFeedback(Runner runner, Activity activity) {
        LocalDate d = activityLocalDate(activity);
        Optional<CoachScheduledWorkout> planned = coachScheduledWorkoutRepository.findByRunnerAndScheduledDate(runner, d);
        if (planned.isEmpty()) {
            return;
        }
        CoachScheduledWorkout p = planned.get();
        if (p.getWorkoutType() != CoachWorkoutType.EASY && p.getWorkoutType() != CoachWorkoutType.RECOVERY) {
            return;
        }
        CoachRunnerState state = getOrCreateState(runner);
        double hrMax = state.getEstimatedHrMaxBpm() != null && state.getEstimatedHrMaxBpm() > 0
                ? state.getEstimatedHrMaxBpm()
                : resolveHrMax(runner, activityRepository.findRunMetricsBetween(
                        runner,
                        ActivityType.RUN,
                        LocalDateTime.now().minusDays(90),
                        LocalDateTime.now()
                ));
        CoachHrBand band = CoachHrZoneClassifier.classify(activity.getAverageHeartRate(), hrMax);
        if (band != CoachHrBand.GREY) {
            return;
        }
        CoachFeedbackAlert alert = new CoachFeedbackAlert();
        alert.setRunner(runner);
        alert.setAlertType("GREY_ZONE_EASY_DAY");
        alert.setMessage("Your heart rate averaged in the grey zone (moderately hard) on a day scheduled as easy/recovery. "
                + "For polarized training, slow easy days by ~15–20 s/km so hard days can stay truly hard.");
        alert.setCreatedAt(LocalDateTime.now());
        alert.setDismissed(false);
        alert.setRelatedActivity(activity);
        coachFeedbackAlertRepository.save(alert);
    }

    private void ensureScheduleHorizon(Runner runner, int days) {
        int horizon = Math.min(28, Math.max(SCHEDULE_HORIZON_DAYS, days));
        LocalDate today = LocalDate.now();
        CoachRunnerState state = coachRunnerStateRepository.findByRunner(runner).orElseGet(() -> getOrCreateState(runner));
        Optional<CoachTrainingBlock> blockOpt = coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner);
        LocalDate end = today.plusDays(horizon - 1L);
        List<CoachScheduledWorkout> existingRows = coachScheduledWorkoutRepository.findByRunnerAndScheduledDateBetween(runner, today, end);
        Set<LocalDate> existingDates = new HashSet<>(existingRows.size());
        for (CoachScheduledWorkout row : existingRows) {
            existingDates.add(row.getScheduledDate());
        }
        List<CoachScheduledWorkout> toCreate = new java.util.ArrayList<>();
        for (int i = 0; i < horizon; i++) {
            LocalDate d = today.plusDays(i);
            if (existingDates.contains(d)) {
                continue;
            }
            CoachScheduledWorkout w = buildDefaultDay(runner, d, state);
            if (blockOpt.isPresent()) {
                applyBlockLongRun(blockOpt.get(), w, d);
            }
            toCreate.add(w);
        }
        if (!toCreate.isEmpty()) {
            try {
                coachScheduledWorkoutRepository.saveAll(toCreate);
            } catch (DataIntegrityViolationException ex) {
                List<CoachScheduledWorkout> refreshed = coachScheduledWorkoutRepository
                        .findByRunnerAndScheduledDateBetween(runner, today, end);
                if (coversFullHorizon(refreshed, today, horizon)) {
                    log.debug("Coach: recovered from concurrent schedule creation for runner {}", runner.getId());
                    return;
                }
                throw ex;
            }
        }
    }

    private void applyBlockLongRun(CoachTrainingBlock block, CoachScheduledWorkout w, LocalDate d) {
        if (d.getDayOfWeek() != DayOfWeek.SATURDAY) {
            return;
        }
        if (w.getWorkoutType() != CoachWorkoutType.LONG_RUN) {
            return;
        }
        w.setPlannedDistanceKm(round1(block.getCurrentLongRunKm()));
        double raceKm = block.getRaceDistanceKm();
        String paceHint = raceKm >= 40
                ? "Include 8–15 km at marathon effort in the middle."
                : "Include 4–8 km at goal race pace in the middle.";
        w.setNotes(paceHint);
    }

    private CoachScheduledWorkout buildDefaultDay(Runner runner, LocalDate d, CoachRunnerState state) {
        CoachScheduledWorkout w = new CoachScheduledWorkout();
        w.setRunner(runner);
        w.setScheduledDate(d);
        w.setReadinessAdjusted(false);

        DayOfWeek dow = d.getDayOfWeek();
        boolean over8020 = state.getHighIntensityRatioLast7d() != null
                && state.getHighIntensityRatioLast7d() > HIGH_INTENSITY_WEEKLY_CAP;

        switch (dow) {
            case MONDAY -> {
                w.setWorkoutType(CoachWorkoutType.EASY);
                w.setPlannedDistanceKm(8.0);
                w.setStridesSuggested(true);
                w.setNotes("Easy aerobic + optional 6–10 × 20 s strides after.");
            }
            case TUESDAY -> {
                w.setWorkoutType(CoachWorkoutType.EASY);
                w.setPlannedDistanceKm(8.0);
                w.setStridesSuggested(false);
            }
            case WEDNESDAY -> {
                if (over8020) {
                    w.setWorkoutType(CoachWorkoutType.EASY);
                    w.setPlannedDistanceKm(8.0);
                    w.setNotes("Polarized guard: keep intensity low until easy volume dominates.");
                } else {
                    w.setWorkoutType(CoachWorkoutType.THRESHOLD);
                    w.setPlannedDistanceKm(10.0);
                    w.setNotes("Quality: threshold / cruise intervals.");
                }
                w.setStridesSuggested(false);
            }
            case THURSDAY -> {
                w.setWorkoutType(CoachWorkoutType.EASY);
                w.setPlannedDistanceKm(7.0);
                w.setStridesSuggested(true);
            }
            case FRIDAY -> {
                w.setWorkoutType(CoachWorkoutType.REST);
                w.setStridesSuggested(false);
            }
            case SATURDAY -> {
                w.setWorkoutType(CoachWorkoutType.LONG_RUN);
                w.setPlannedDistanceKm(14.0);
                w.setStridesSuggested(false);
                w.setNotes("Aerobic long run — stay conversational on non-work sections.");
            }
            case SUNDAY -> {
                w.setWorkoutType(CoachWorkoutType.RECOVERY);
                w.setPlannedDistanceKm(6.0);
                w.setStridesSuggested(false);
            }
            default -> {
                w.setWorkoutType(CoachWorkoutType.EASY);
                w.setPlannedDistanceKm(8.0);
            }
        }
        return w;
    }

    private double estimateSeedLongRunKm(Runner runner) {
        LocalDateTime now = LocalDateTime.now();
        List<Activity> runs28 = activityRepository.findRunsBetween(runner, ActivityType.RUN, now.minusDays(28), now);
        double maxLong = 0;
        for (Activity a : runs28) {
            double km = distanceKm(a);
            if (km > maxLong) {
                maxLong = km;
            }
        }
        if (maxLong >= 10) {
            return round1(Math.min(maxLong, 32));
        }
        return 12.0;
    }

    private static boolean isHighIntensityPlanned(CoachWorkoutType t) {
        return t == CoachWorkoutType.THRESHOLD || t == CoachWorkoutType.INTERVALS || t == CoachWorkoutType.TEMPO;
    }

    private CoachRunnerState getOrCreateState(Runner runner) {
        Optional<CoachRunnerState> existing = coachRunnerStateRepository.findByRunner(runner);
        if (existing.isPresent()) {
            return existing.get();
        }
        CoachRunnerState s = new CoachRunnerState();
        s.setRunner(runner);
        try {
            return coachRunnerStateRepository.save(s);
        } catch (DataIntegrityViolationException ex) {
            return coachRunnerStateRepository.findByRunner(runner).orElseThrow(() -> ex);
        }
    }

    private boolean coversFullHorizon(List<CoachScheduledWorkout> rows, LocalDate start, int horizon) {
        if (rows.size() < horizon) {
            return false;
        }
        Set<LocalDate> dates = new HashSet<>(rows.size());
        for (CoachScheduledWorkout row : rows) {
            dates.add(row.getScheduledDate());
        }
        for (int i = 0; i < horizon; i++) {
            if (!dates.contains(start.plusDays(i))) {
                return false;
            }
        }
        return true;
    }

    private double resolveHrMax(Runner runner, List<RunMetricsProjection> pool) {
        if (runner.getMaxHeartRateBpm() != null && runner.getMaxHeartRateBpm() >= 130) {
            return CoachHrZoneClassifier.clampHrMax(runner.getMaxHeartRateBpm());
        }
        double max = 0;
        for (RunMetricsProjection a : pool) {
            if (a.getMaxHeartRate() != null && a.getMaxHeartRate() > max) {
                max = a.getMaxHeartRate();
            }
        }
        if (max >= 130) {
            return CoachHrZoneClassifier.clampHrMax(max);
        }
        return 185;
    }

    private static int movingMinutes(RunMetricsProjection a) {
        int sec = a.getMovingTimeSeconds() != null ? a.getMovingTimeSeconds() : 0;
        if (sec <= 0 && a.getDurationSeconds() != null) {
            sec = a.getDurationSeconds().intValue();
        }
        return Math.max(0, sec / 60);
    }

    private static double distanceKm(RunMetricsProjection a) {
        if (a.getDistanceKm() != null && a.getDistanceKm() > 0) {
            return a.getDistanceKm();
        }
        if (a.getDistanceMeters() != null && a.getDistanceMeters() > 0) {
            return a.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private static double distanceKm(Activity a) {
        if (a.getDistanceKm() > 0) {
            return a.getDistanceKm();
        }
        if (a.getDistanceMeters() != null && a.getDistanceMeters() > 0) {
            return a.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private static LocalDate activityLocalDate(Activity a) {
        if (a.getStartTime() != null) {
            return a.getStartTime().toLocalDate();
        }
        if (a.getStartDate() != null && !a.getStartDate().isBlank()) {
            String s = a.getStartDate().trim();
            try {
                if (s.length() >= 10) {
                    return LocalDate.parse(s.substring(0, 10));
                }
            } catch (Exception ignored) {
            }
            try {
                return OffsetDateTime.parse(s).toLocalDate();
            } catch (Exception ignored) {
            }
        }
        if (a.getCreatedAt() != null) {
            return a.getCreatedAt().toLocalDate();
        }
        return LocalDate.now();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private CoachRouteRecommendationDto buildRouteRecommendation(
            Runner runner,
            CoachScheduledWorkout adjustedToday,
            List<CoachScheduledWorkout> scheduleRows
    ) {
        List<Long> recentActivityIds = activityRepository.findRecentIdsByRunnerAndActivityType(
                runner.getId(),
                ActivityType.RUN.name(),
                SCHEDULE_ROUTE_ACTIVITY_LIMIT
        );
        if (recentActivityIds == null || recentActivityIds.isEmpty()) {
            return null;
        }

        Map<Long, Activity> activitiesById = new HashMap<>();
        for (Activity activity : activityRepository.findAllById(recentActivityIds)) {
            if (activity != null) {
                activitiesById.put(activity.getId(), activity);
            }
        }

        Map<Long, List<RoutePointSample>> pointsByActivityId = new HashMap<>();
        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (Object[] row : activityPointRepository.findHeatmapPointsByActivityIds(recentActivityIds)) {
            if (row == null || row.length < 5 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            if (!activitiesById.containsKey(activityId)) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            double distanceMeters = row[3] instanceof Number number ? number.doubleValue() : Double.NaN;
            int elapsedSeconds = row[4] instanceof Number number ? number.intValue() : 0;
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                continue;
            }

            pointsByActivityId.computeIfAbsent(activityId, ignored -> new ArrayList<>())
                    .add(new RoutePointSample(latitude, longitude, distanceMeters, elapsedSeconds));
            minLatitude = Math.min(minLatitude, latitude);
            maxLatitude = Math.max(maxLatitude, latitude);
            minLongitude = Math.min(minLongitude, longitude);
            maxLongitude = Math.max(maxLongitude, longitude);
        }

        if (pointsByActivityId.isEmpty()) {
            return null;
        }

        RouteBounds bounds = minLatitude == Double.POSITIVE_INFINITY
                ? null
                : new RouteBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
        Double targetDistanceKm = resolveTargetRouteDistanceKm(adjustedToday, scheduleRows);

        List<RouteActivityCandidate> candidates = new ArrayList<>();
        int recentRank = 0;
        for (Long activityId : recentActivityIds) {
            Activity activity = activitiesById.get(activityId);
            List<RoutePointSample> samples = pointsByActivityId.get(activityId);
            if (activity == null || samples == null || samples.size() < 2) {
                recentRank += 1;
                continue;
            }
            Double distanceKm = resolveActivityDistanceKm(activity, samples);
            RouteCentroid centroid = buildCentroid(samples);
            CoachRoutePreviewDto preview = buildRoutePreview(samples);
            if (preview == null || centroid == null) {
                recentRank += 1;
                continue;
            }
            candidates.add(new RouteActivityCandidate(activityId, distanceKm, recentRank, samples, centroid, preview));
            recentRank += 1;
        }

        if (candidates.isEmpty()) {
            return null;
        }

        List<RouteCluster> clusters = new ArrayList<>();
        for (RouteActivityCandidate candidate : candidates) {
            RouteCluster bestCluster = null;
            double bestDistance = Double.POSITIVE_INFINITY;
            for (RouteCluster cluster : clusters) {
                double distance = haversineMeters(
                        candidate.centroid().latitude(),
                        candidate.centroid().longitude(),
                        cluster.centroid().latitude(),
                        cluster.centroid().longitude()
                );
                if (distance <= ROUTE_CLUSTER_RADIUS_METERS && distance < bestDistance) {
                    bestCluster = cluster;
                    bestDistance = distance;
                }
            }

            if (bestCluster == null) {
                bestCluster = new RouteCluster(new ArrayList<>(), candidate.centroid());
                clusters.add(bestCluster);
            }
            bestCluster.add(candidate);
        }

        return clusters.stream()
                .min(routeClusterComparator(targetDistanceKm))
                .map(cluster -> toRouteRecommendation(cluster, bounds, targetDistanceKm))
                .orElse(null);
    }

    private Double resolveTargetRouteDistanceKm(CoachScheduledWorkout adjustedToday, List<CoachScheduledWorkout> scheduleRows) {
        Double todayDistanceKm = positiveDistanceKm(adjustedToday);
        if (todayDistanceKm != null) {
            return todayDistanceKm;
        }

        LocalDate today = adjustedToday != null && adjustedToday.getScheduledDate() != null
                ? adjustedToday.getScheduledDate()
                : LocalDate.now();
        return scheduleRows == null ? null : scheduleRows.stream()
                .filter(workout -> workout != null && workout.getScheduledDate() != null && workout.getScheduledDate().isAfter(today))
                .map(AutomatedCoachService::positiveDistanceKm)
                .filter(AutomatedCoachService::hasPositiveDistance)
                .findFirst()
                .orElse(null);
    }

    private static Double positiveDistanceKm(CoachScheduledWorkout workout) {
        if (workout == null || workout.getPlannedDistanceKm() == null || workout.getPlannedDistanceKm() <= 0) {
            return null;
        }
        return workout.getPlannedDistanceKm();
    }

    private static boolean hasPositiveDistance(Double distanceKm) {
        return distanceKm != null && distanceKm > 0;
    }

    private static Double resolveActivityDistanceKm(Activity activity, List<RoutePointSample> samples) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        RoutePointSample lastSample = samples.get(samples.size() - 1);
        if (Double.isFinite(lastSample.distanceMeters()) && lastSample.distanceMeters() > 0) {
            return lastSample.distanceMeters() / 1000.0;
        }
        return null;
    }

    private CoachRouteRecommendationDto toRouteRecommendation(RouteCluster cluster, RouteBounds bounds, Double targetDistanceKm) {
        RouteActivityCandidate representative = cluster.representative(targetDistanceKm);
        String confidence = resolveRouteConfidence(targetDistanceKm, representative.distanceKm());
        return new CoachRouteRecommendationDto(
                deriveZoneKey(cluster.centroid(), bounds),
                confidence,
                targetDistanceKm,
                representative.distanceKm(),
                cluster.candidates().size(),
                representative.preview()
        );
    }

    private Comparator<RouteCluster> routeClusterComparator(Double targetDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm)) {
            return Comparator
                    .comparingInt((RouteCluster cluster) -> cluster.recentActivityRank())
                    .thenComparing(Comparator.comparingInt(RouteCluster::activityCount).reversed());
        }

        return Comparator
                .comparingDouble((RouteCluster cluster) -> distanceGapKm(targetDistanceKm, cluster.representative(targetDistanceKm).distanceKm()))
                .thenComparingInt(cluster -> cluster.representative(targetDistanceKm).recentRank())
                .thenComparing(Comparator.comparingInt(RouteCluster::activityCount).reversed());
    }

    private static double distanceGapKm(Double targetDistanceKm, Double representativeDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm) || !hasPositiveDistance(representativeDistanceKm)) {
            return Double.POSITIVE_INFINITY;
        }
        return Math.abs(representativeDistanceKm - targetDistanceKm);
    }

    private static String resolveRouteConfidence(Double targetDistanceKm, Double representativeDistanceKm) {
        if (!hasPositiveDistance(targetDistanceKm) || !hasPositiveDistance(representativeDistanceKm)) {
            return "best-available";
        }
        double gapKm = Math.abs(representativeDistanceKm - targetDistanceKm);
        double strongThresholdKm = Math.max(1.0, targetDistanceKm * 0.12);
        double nearThresholdKm = Math.max(2.5, targetDistanceKm * 0.28);
        if (gapKm <= strongThresholdKm) {
            return "distance-match";
        }
        if (gapKm <= nearThresholdKm) {
            return "near-match";
        }
        return "best-available";
    }

    private static RouteCentroid buildCentroid(List<RoutePointSample> samples) {
        if (samples == null || samples.isEmpty()) {
            return null;
        }
        double sumLatitude = 0;
        double sumLongitude = 0;
        for (RoutePointSample sample : samples) {
            sumLatitude += sample.latitude();
            sumLongitude += sample.longitude();
        }
        return new RouteCentroid(sumLatitude / samples.size(), sumLongitude / samples.size());
    }

    private static CoachRoutePreviewDto buildRoutePreview(List<RoutePointSample> samples) {
        if (samples == null || samples.size() < 2) {
            return null;
        }
        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (RoutePointSample sample : samples) {
            minLatitude = Math.min(minLatitude, sample.latitude());
            maxLatitude = Math.max(maxLatitude, sample.latitude());
            minLongitude = Math.min(minLongitude, sample.longitude());
            maxLongitude = Math.max(maxLongitude, sample.longitude());
        }

        double padding = 10.0;
        double width = 100.0;
        double height = 100.0;
        double latitudeSpan = Math.max(0.00012, maxLatitude - minLatitude);
        double longitudeSpan = Math.max(0.00012, maxLongitude - minLongitude);
        double innerWidth = width - (padding * 2.0);
        double innerHeight = height - (padding * 2.0);
        int stride = Math.max(1, samples.size() / ROUTE_PREVIEW_POINT_LIMIT);
        List<RoutePreviewPoint> normalized = new ArrayList<>();
        for (int index = 0; index < samples.size(); index += stride) {
            normalized.add(normalizePreviewPoint(samples.get(index), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight));
        }
        RoutePointSample lastSample = samples.get(samples.size() - 1);
        RoutePreviewPoint lastPoint = normalizePreviewPoint(lastSample, minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight);
        if (normalized.isEmpty() || !samePreviewPoint(normalized.get(normalized.size() - 1), lastPoint)) {
            normalized.add(lastPoint);
        }
        if (normalized.size() < 2) {
            return null;
        }

        StringBuilder path = new StringBuilder();
        for (int index = 0; index < normalized.size(); index++) {
            RoutePreviewPoint point = normalized.get(index);
            if (index > 0) {
                path.append(' ');
            }
            path.append(index == 0 ? 'M' : 'L')
                    .append(' ')
                    .append(formatPreviewCoordinate(point.x()))
                    .append(' ')
                    .append(formatPreviewCoordinate(point.y()));
        }

        RoutePreviewPoint start = normalized.get(0);
        RoutePreviewPoint finish = normalized.get(normalized.size() - 1);
        return new CoachRoutePreviewDto(path.toString(), start.x(), start.y(), finish.x(), finish.y());
    }

    private static RoutePreviewPoint normalizePreviewPoint(
            RoutePointSample sample,
            double minLatitude,
            double latitudeSpan,
            double minLongitude,
            double longitudeSpan,
            double padding,
            double innerWidth,
            double innerHeight
    ) {
        double x = padding + (((sample.longitude() - minLongitude) / longitudeSpan) * innerWidth);
        double y = padding + (innerHeight - (((sample.latitude() - minLatitude) / latitudeSpan) * innerHeight));
        return new RoutePreviewPoint(x, y);
    }

    private static boolean samePreviewPoint(RoutePreviewPoint left, RoutePreviewPoint right) {
        return Math.abs(left.x() - right.x()) < 0.001 && Math.abs(left.y() - right.y()) < 0.001;
    }

    private static String formatPreviewCoordinate(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f", value);
    }

    private static double haversineMeters(double latitudeA, double longitudeA, double latitudeB, double longitudeB) {
        double deltaLatitude = Math.toRadians(latitudeB - latitudeA);
        double deltaLongitude = Math.toRadians(longitudeB - longitudeA);
        double a = Math.sin(deltaLatitude / 2.0) * Math.sin(deltaLatitude / 2.0)
                + Math.cos(Math.toRadians(latitudeA)) * Math.cos(Math.toRadians(latitudeB))
                * Math.sin(deltaLongitude / 2.0) * Math.sin(deltaLongitude / 2.0);
        return EARTH_RADIUS_METERS * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private static String deriveZoneKey(RouteCentroid centroid, RouteBounds bounds) {
        if (centroid == null || bounds == null) {
            return "core";
        }
        double latitudeSpan = Math.max(0.0001, bounds.maxLatitude() - bounds.minLatitude());
        double longitudeSpan = Math.max(0.0001, bounds.maxLongitude() - bounds.minLongitude());
        double vertical = (centroid.latitude() - bounds.minLatitude()) / latitudeSpan;
        double horizontal = (centroid.longitude() - bounds.minLongitude()) / longitudeSpan;

        String northSouth = vertical >= 0.66 ? "north" : vertical <= 0.34 ? "south" : "mid";
        String eastWest = horizontal >= 0.66 ? "east" : horizontal <= 0.34 ? "west" : "mid";

        if ("mid".equals(northSouth) && "mid".equals(eastWest)) {
            return "core";
        }
        if ("mid".equals(northSouth)) {
            return eastWest;
        }
        if ("mid".equals(eastWest)) {
            return northSouth;
        }
        return northSouth + "-" + eastWest;
    }

    private static CoachScheduledWorkoutDto toScheduledDto(CoachScheduledWorkout w) {
        return new CoachScheduledWorkoutDto(
                w.getScheduledDate(),
                w.getWorkoutType().name(),
                w.getPlannedDistanceKm(),
                w.getPlannedDurationMinutes(),
                w.isStridesSuggested(),
                w.getNotes(),
                w.getMutatedFrom() != null ? w.getMutatedFrom().name() : null,
                w.isReadinessAdjusted()
        );
    }

    private CoachStateDto toStateDto(Runner runner, CoachRunnerState s, CoachScheduledWorkout todayWorkout) {
        CoachStaminaDto stamina = buildStaminaDto(runner, s, todayWorkout);
        return new CoachStateDto(
                s.getVolumeKm7d(),
                s.getVolumeKm28d(),
                s.getMinutesLowZ1Z2Last7d(),
                s.getMinutesGreyZ3Last7d(),
                s.getMinutesHighZ4Z5Last7d(),
                s.getMinutesUnknownHrLast7d(),
                s.getHighIntensityRatioLast7d(),
                s.isHighMileageGrinder(),
                s.getBaselineRestingHr(),
                s.getLastNightRestingHr(),
                s.getLastSleepScore(),
                s.getLastHrvMs(),
                runner.getMaxHeartRateBpm(),
                runner.getRestingHeartRateBpm(),
                stamina,
                coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).map(b -> new CoachTrainingBlockDto(
                        b.getRaceDistanceKm(),
                        b.getTargetRaceDate(),
                        b.getWeekIndex(),
                        b.getCurrentLongRunKm(),
                        b.getName()
                )).orElse(null)
        );
    }

    private CoachStaminaDto buildStaminaDto(Runner runner, CoachRunnerState state, CoachScheduledWorkout todayWorkout) {
        int recoveryCap = 100;

        Integer sleepScore = state.getLastSleepScore();
        if (sleepScore != null) {
            if (sleepScore < 60) recoveryCap -= 12;
            else if (sleepScore < 70) recoveryCap -= 7;
            else if (sleepScore < 78) recoveryCap -= 4;
        }

        Integer baselineRestingHr = state.getBaselineRestingHr() != null ? state.getBaselineRestingHr() : runner.getRestingHeartRateBpm();
        Integer lastNightRestingHr = state.getLastNightRestingHr();
        Integer restingDelta = baselineRestingHr != null && lastNightRestingHr != null
                ? lastNightRestingHr - baselineRestingHr
                : null;
        if (restingDelta != null) {
            if (restingDelta >= 5) recoveryCap -= 10;
            else if (restingDelta >= 3) recoveryCap -= 6;
            else if (restingDelta <= -2) recoveryCap += 1;
        }

        Integer hrv = state.getLastHrvMs();
        if (hrv != null) {
            if (hrv < 30) recoveryCap -= 6;
            else if (hrv < 40) recoveryCap -= 3;
        }

        double weeklyLoadBaseline = Math.max(1.0, state.getVolumeKm28d() / 4.0);
        double weeklyLoadRatio = state.getVolumeKm7d() / weeklyLoadBaseline;
        if (weeklyLoadRatio > 1.25) recoveryCap -= 6;
        else if (weeklyLoadRatio > 1.15) recoveryCap -= 3;

        if (state.isHighMileageGrinder()) recoveryCap -= 4;
        recoveryCap = Math.max(60, Math.min(100, recoveryCap));

        int score = recoveryCap;
        CoachWorkoutType workoutType = todayWorkout != null ? todayWorkout.getWorkoutType() : null;
        if (workoutType != null) {
            switch (workoutType) {
                case REST -> score -= 0;
                case RECOVERY, CROSS_TRAIN -> score -= 1;
                case EASY -> score -= 2;
                case LONG_RUN -> score -= 5;
                case TEMPO, THRESHOLD -> score -= 7;
                case INTERVALS -> score -= 9;
                default -> score -= 2;
            }
        }

        Double highIntensityRatio = state.getHighIntensityRatioLast7d();
        if (highIntensityRatio != null) {
            if (highIntensityRatio > 0.20) score -= 3;
            else if (highIntensityRatio < 0.12) score += 1;
        }
        score = Math.max(42, Math.min(recoveryCap, score));

        Integer targetPaceSecondsPerKm = null;
        if (todayWorkout != null && todayWorkout.getPlannedDistanceKm() != null && todayWorkout.getPlannedDistanceKm() > 0
                && todayWorkout.getPlannedDurationMinutes() != null && todayWorkout.getPlannedDurationMinutes() > 0) {
            targetPaceSecondsPerKm = (int) Math.round((todayWorkout.getPlannedDurationMinutes() * 60.0) / todayWorkout.getPlannedDistanceKm());
        }

        Double hrMax = state.getEstimatedHrMaxBpm() != null ? state.getEstimatedHrMaxBpm() : (runner.getMaxHeartRateBpm() != null ? runner.getMaxHeartRateBpm().doubleValue() : null);
        Integer targetHeartRateBpm = hrMax == null ? null : (int) Math.round(hrMax * 0.62);

        String direction = score < recoveryCap ? "down" : score > recoveryCap ? "up" : "steady";
        return new CoachStaminaDto(score, recoveryCap, targetPaceSecondsPerKm, targetHeartRateBpm, direction);
    }

    // --- DTO records (API responses) ---

    public record CoachScheduledWorkoutDto(
            LocalDate scheduledDate,
            String workoutType,
            Double plannedDistanceKm,
            Integer plannedDurationMinutes,
            boolean stridesSuggested,
            String notes,
            String mutatedFrom,
            boolean readinessAdjusted
    ) {}

    public record CoachStateDto(
            double volumeKm7d,
            double volumeKm28d,
            int minutesLowZ1Z2Last7d,
            int minutesGreyZ3Last7d,
            int minutesHighZ4Z5Last7d,
            int minutesUnknownHrLast7d,
            Double highIntensityRatioLast7d,
            boolean highMileageGrinder,
            Integer baselineRestingHr,
            Integer lastNightRestingHr,
            Integer lastSleepScore,
            Integer lastHrvMs,
            Integer profileMaxHeartRateBpm,
            Integer profileRestingHeartRateBpm,
            CoachStaminaDto stamina,
            CoachTrainingBlockDto activeBlock
    ) {}

    public record CoachStaminaDto(
            int scorePercent,
            int recoveryCapPercent,
            Integer targetPaceSecondsPerKm,
            Integer targetHeartRateBpm,
            String direction
    ) {}

    public record CoachRoutePreviewDto(
            String path,
            double startX,
            double startY,
            double finishX,
            double finishY
    ) {}

    public record CoachRouteRecommendationDto(
            String zoneKey,
            String confidence,
            Double targetDistanceKm,
            Double representativeDistanceKm,
            int activityCount,
            CoachRoutePreviewDto preview
    ) {}

    public record CoachTrainingBlockDto(
            double raceDistanceKm,
            LocalDate targetRaceDate,
            int weekIndex,
            double currentLongRunKm,
            String name
    ) {}

    public record CoachTodayDto(CoachScheduledWorkoutDto today, CoachStateDto state, CoachRouteRecommendationDto routeRecommendation) {}

    public record CoachFeedbackAlertDto(Long id, String alertType, String message, LocalDateTime createdAt) {}

    private record RoutePointSample(double latitude, double longitude, double distanceMeters, int elapsedSeconds) {}

    private record RouteCentroid(double latitude, double longitude) {}

    private record RouteBounds(double minLatitude, double minLongitude, double maxLatitude, double maxLongitude) {}

    private record RoutePreviewPoint(double x, double y) {}

    private record RouteActivityCandidate(
            long activityId,
            Double distanceKm,
            int recentRank,
            List<RoutePointSample> samples,
            RouteCentroid centroid,
            CoachRoutePreviewDto preview
    ) {}

    private static final class RouteCluster {
        private final List<RouteActivityCandidate> candidates;
        private double sumLatitude;
        private double sumLongitude;
        private RouteCentroid centroid;

        private RouteCluster(List<RouteActivityCandidate> candidates, RouteCentroid initialCentroid) {
            this.candidates = candidates;
            this.sumLatitude = 0.0;
            this.sumLongitude = 0.0;
            this.centroid = initialCentroid;
        }

        private void add(RouteActivityCandidate candidate) {
            candidates.add(candidate);
            sumLatitude += candidate.centroid().latitude();
            sumLongitude += candidate.centroid().longitude();
            centroid = new RouteCentroid(sumLatitude / candidates.size(), sumLongitude / candidates.size());
        }

        private List<RouteActivityCandidate> candidates() {
            return candidates;
        }

        private RouteCentroid centroid() {
            return centroid;
        }

        private int activityCount() {
            return candidates.size();
        }

        private int recentActivityRank() {
            return candidates.stream()
                    .mapToInt(RouteActivityCandidate::recentRank)
                    .min()
                    .orElse(Integer.MAX_VALUE);
        }

        private RouteActivityCandidate representative(Double targetDistanceKm) {
            Comparator<RouteActivityCandidate> comparator;
            if (hasPositiveDistance(targetDistanceKm)) {
                comparator = Comparator
                        .comparingDouble((RouteActivityCandidate candidate) -> distanceGapKm(targetDistanceKm, candidate.distanceKm()))
                        .thenComparingInt(RouteActivityCandidate::recentRank);
            } else {
                comparator = Comparator.comparingInt(RouteActivityCandidate::recentRank);
            }
            return candidates.stream().min(comparator).orElseThrow();
        }
    }
}
