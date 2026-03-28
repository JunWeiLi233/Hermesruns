package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
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

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final CoachRunnerStateRepository coachRunnerStateRepository;
    private final CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;
    private final CoachTrainingBlockRepository coachTrainingBlockRepository;
    private final CoachFeedbackAlertRepository coachFeedbackAlertRepository;

    public AutomatedCoachService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
            CoachTrainingBlockRepository coachTrainingBlockRepository,
            CoachFeedbackAlertRepository coachFeedbackAlertRepository
    ) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
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
        return toStateDto(runner, state);
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
        CoachScheduledWorkout row = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDate(runner, today)
                .orElseGet(() -> {
                    CoachScheduledWorkout w = buildDefaultDay(runner, today, state);
                    coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> applyBlockLongRun(b, w, today));
                    return coachScheduledWorkoutRepository.save(w);
                });
        CoachScheduledWorkout adjusted = applyReadinessGate(runner, state, row);
        return new CoachTodayDto(toScheduledDto(adjusted), toStateDto(runner, state));
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
            coachScheduledWorkoutRepository.saveAll(toCreate);
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
        return coachRunnerStateRepository.findByRunner(runner).orElseGet(() -> {
            CoachRunnerState s = new CoachRunnerState();
            s.setRunner(runner);
            return coachRunnerStateRepository.save(s);
        });
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

    private CoachStateDto toStateDto(Runner runner, CoachRunnerState s) {
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
                coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).map(b -> new CoachTrainingBlockDto(
                        b.getRaceDistanceKm(),
                        b.getTargetRaceDate(),
                        b.getWeekIndex(),
                        b.getCurrentLongRunKm(),
                        b.getName()
                )).orElse(null)
        );
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
            CoachTrainingBlockDto activeBlock
    ) {}

    public record CoachTrainingBlockDto(
            double raceDistanceKm,
            LocalDate targetRaceDate,
            int weekIndex,
            double currentLongRunKm,
            String name
    ) {}

    public record CoachTodayDto(CoachScheduledWorkoutDto today, CoachStateDto state) {}

    public record CoachFeedbackAlertDto(Long id, String alertType, String message, LocalDateTime createdAt) {}
}
