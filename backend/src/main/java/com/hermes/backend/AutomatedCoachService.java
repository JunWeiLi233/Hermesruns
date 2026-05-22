package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Polarized (80/20) automated coach: rolling aggregates, schedule mutation, grey-zone feedback,
 * readiness gate, and progressive long-run blocks.
 * 
 * Extracted route logic to CoachRouteService to reduce file size.
 */
@Service
public class AutomatedCoachService {

    private static final Logger log = LoggerFactory.getLogger(AutomatedCoachService.class);

    private static final double HIGH_INTENSITY_WEEKLY_CAP = 0.20;
    private static final double HIGH_MILEAGE_KM_28D = 200.0;
    private static final double LONG_RUN_WEEKLY_BUMP = 1.12;
    private static final int SCHEDULE_HORIZON_DAYS = 14;
    private final ConcurrentMap<Long, Object> scheduleHorizonLocks = new ConcurrentHashMap<>();

    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final CoachRunnerStateRepository coachRunnerStateRepository;
    private final CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;
    private final CoachTrainingBlockRepository coachTrainingBlockRepository;
    private final CoachFeedbackAlertRepository coachFeedbackAlertRepository;
    private final ShoeTracker shoeTracker;
    private final CoachRouteService coachRouteService;
    private final ReadinessService readinessService;

    public AutomatedCoachService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
            CoachTrainingBlockRepository coachTrainingBlockRepository,
            CoachFeedbackAlertRepository coachFeedbackAlertRepository,
            ShoeTracker shoeTracker,
            CoachRouteService coachRouteService,
            ReadinessService readinessService
    ) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.coachRunnerStateRepository = coachRunnerStateRepository;
        this.coachScheduledWorkoutRepository = coachScheduledWorkoutRepository;
        this.coachTrainingBlockRepository = coachTrainingBlockRepository;
        this.coachFeedbackAlertRepository = coachFeedbackAlertRepository;
        this.shoeTracker = shoeTracker;
        this.coachRouteService = coachRouteService;
        this.readinessService = readinessService;
    }

    @Transactional
    public void handleActivityIngested(Long runnerId, Long activityId) {
        Optional<Runner> runnerOpt = runnerRepository.findById(runnerId);
        if (runnerOpt.isEmpty()) return;
        Runner runner = runnerOpt.get();
        Optional<Activity> activityOpt = activityRepository.findById(activityId);
        if (activityOpt.isEmpty() || activityOpt.get().getActivityType() != ActivityType.RUN) return;
        Activity activity = activityOpt.get();

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
            if (runner.isDeleted()) continue;
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
        CoachRunnerState state = getOrCreateState(runner);
        return rows.stream()
                .map(row -> today.equals(row.getScheduledDate()) ? applyReadinessGate(state, row) : row)
                .map(AutomatedCoachService::toScheduledDto)
                .toList();
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
                    CoachScheduledWorkout w = buildDefaultDay(runner, today);
                    coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> applyBlockLongRun(b, w));
                    CoachScheduledWorkout saved = coachScheduledWorkoutRepository.save(w);
                    rows.add(0, saved);
                    return saved;
                });
        CoachScheduledWorkout adjusted = applyReadinessGate(state, row);
        CoachRouteRecommendationDto routeRecommendation = coachRouteService.buildRouteRecommendation(runner, adjusted, rows);
        
        String preferredSurface = inferScheduledSurface(adjusted);
        CoachRecommendedShoeDto shoeRec = shoeTracker.recommendShoe(runner, adjusted.getWorkoutType(), preferredSurface)
                .map(s -> new CoachRecommendedShoeDto(
                        s.getId(), s.getBrand(), s.getModel(), s.getNickname(), s.getPhotoUrl(),
                        s.getCurrentDistanceKm(), s.getMaxDistanceKm(), s.getType(), s.getSurfaceType(),
                        s.getLastWornAt(), s.getDaysSinceLastWear(),
                        recommendedShoeReason(adjusted.getWorkoutType(), preferredSurface)
                ))
                .orElse(null);

        return new CoachTodayDto(toScheduledDto(adjusted), toStateDto(runner, state, adjusted), routeRecommendation, shoeRec);
    }

    @Transactional
    public void logRecoveryMetrics(Runner runner, Integer restingHr, Integer sleepScore, Integer hrvMs, Integer stressScore) {
        CoachRunnerState state = getOrCreateState(runner);
        if (restingHr != null && restingHr > 30 && restingHr < 120) state.setLastNightRestingHr(restingHr);
        if (sleepScore != null && sleepScore >= 0 && sleepScore <= 100) state.setLastSleepScore(sleepScore);
        if (hrvMs != null && hrvMs >= 0 && hrvMs < 5000) state.setLastHrvMs(hrvMs);
        if (stressScore != null && stressScore >= 0 && stressScore <= 100) state.setLastStressScore(stressScore);
        state.setLastRecoveryLoggedAt(LocalDateTime.now());
        coachRunnerStateRepository.save(state);
    }

    @Transactional
    public void updateCoachProfile(Runner runner, Integer maxHr, Integer restingHr) {
        if (maxHr != null) {
            if (maxHr < 120 || maxHr > 230) throw new IllegalArgumentException("maxHeartRateBpm out of range.");
            runner.setMaxHeartRateBpm(maxHr);
        }
        if (restingHr != null) {
            if (restingHr < 30 || restingHr > 120) throw new IllegalArgumentException("restingHeartRateBpm out of range.");
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
        if (opt.isEmpty()) return false;
        CoachFeedbackAlert a = opt.get();
        a.setDismissed(true);
        coachFeedbackAlertRepository.save(a);
        return true;
    }

    private void aggregateState(Runner runner) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from7 = now.minusDays(7);
        LocalDateTime from28 = now.minusDays(28);
        LocalDateTime from90 = now.minusDays(90);

        List<RunMetricsProjection> runs90 = activityRepository.findRunMetricsBetween(runner, ActivityType.RUN, from90, now);
        double hrMax = resolveHrMax(runner, runs90);

        int low = 0, grey = 0, high = 0, unknown = 0;
        double vol7 = 0, vol28 = 0;
        for (RunMetricsProjection a : runs90) {
            LocalDateTime ts = a.getEffectiveStartTime();
            if (ts == null) continue;
            double dist = (a.getDistanceKm() > 0) ? a.getDistanceKm() : (a.getDistanceMeters() / 1000.0);
            if (!ts.isBefore(from28)) vol28 += dist;
            if (!ts.isBefore(from7)) {
                vol7 += dist;
                Double maxHrRow = a.getMaxHeartRate();
                int durationMinutes = durationMinutes(a);
                if (maxHrRow == null || maxHrRow == 0 || hrMax == 0) {
                    unknown += durationMinutes;
                } else {
                    double peakPct = maxHrRow / hrMax;
                    if (peakPct < 0.80) low += durationMinutes;
                    else if (peakPct < 0.88) grey += durationMinutes;
                    else high += durationMinutes;
                }
            }
        }

        CoachRunnerState state = getOrCreateState(runner);
        state.setVolumeKm7d(round1(vol7));
        state.setVolumeKm28d(round1(vol28));
        state.setMinutesLowZ1Z2Last7d(low);
        state.setMinutesGreyZ3Last7d(grey);
        state.setMinutesHighZ4Z5Last7d(high);
        state.setMinutesUnknownHrLast7d(unknown);
        int totalTracked = low + grey + high;
        state.setHighIntensityRatioLast7d(totalTracked > 0 ? (double) high / totalTracked : 0.0);
        state.setHighMileageGrinder(vol28 > HIGH_MILEAGE_KM_28D);
        state.setLastAggregatedAt(LocalDateTime.now());
        coachRunnerStateRepository.save(state);
    }

    private int durationMinutes(RunMetricsProjection activity) {
        Long durationSeconds = activity.getDurationSeconds();
        if (durationSeconds == null || durationSeconds <= 0) {
            return 0;
        }
        return (int) (durationSeconds / 60);
    }

    private void checkGreyZoneFeedback(Runner runner, Activity activity) {
        if (activity.getMaxHeartRate() == null || activity.getMaxHeartRate() == 0) return;
        double hrMax = runner.getMaxHeartRateBpm() != null ? runner.getMaxHeartRateBpm() : 190.0;
        double peakPct = activity.getMaxHeartRate() / hrMax;
        if (peakPct >= 0.81 && peakPct <= 0.87) {
            String msg = "Your recent run was in the 'Grey Zone'. Try to keep easy runs easier or hard runs harder.";
            if (coachFeedbackAlertRepository.findByRunnerAndMessage(runner, msg).isEmpty()) {
                CoachFeedbackAlert alert = new CoachFeedbackAlert();
                alert.setRunner(runner);
                alert.setAlertType("GREY_ZONE");
                alert.setMessage(msg);
                alert.setCreatedAt(LocalDateTime.now());
                coachFeedbackAlertRepository.save(alert);
            }
        }
    }

    private void ensureScheduleHorizon(Runner runner, int days) {
        LocalDate today = LocalDate.now();
        LocalDate horizonEnd = today.plusDays(days - 1L);

        synchronized (scheduleHorizonLocks.computeIfAbsent(runner.getId(), ignored -> new Object())) {
            Optional<CoachTrainingBlock> blockOpt = coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner);
            Set<LocalDate> existingDates = new HashSet<>();
            for (CoachScheduledWorkout existing : coachScheduledWorkoutRepository.findByRunnerAndScheduledDateBetween(runner, today, horizonEnd)) {
                if (existing.getScheduledDate() != null) {
                    existingDates.add(existing.getScheduledDate());
                }
            }

            List<CoachScheduledWorkout> toCreate = new ArrayList<>();
            for (int i = 0; i < days; i++) {
                LocalDate date = today.plusDays(i);
                if (existingDates.contains(date)) continue;
                CoachScheduledWorkout w = buildDefaultDay(runner, date);
                blockOpt.ifPresent(b -> applyBlockLongRun(b, w));
                toCreate.add(w);
                existingDates.add(date);
            }

            if (!toCreate.isEmpty()) {
                try {
                    coachScheduledWorkoutRepository.saveAll(toCreate);
                } catch (DataIntegrityViolationException race) {
                    if (!hasScheduleHorizon(runner, today, horizonEnd, days)) {
                        throw race;
                    }
                    log.debug("Recovered coach schedule horizon race for runner {}", runner.getId());
                }
            }
        }
    }

    private boolean hasScheduleHorizon(Runner runner, LocalDate start, LocalDate end, int days) {
        Set<LocalDate> recoveredDates = new HashSet<>();
        for (CoachScheduledWorkout existing : coachScheduledWorkoutRepository.findByRunnerAndScheduledDateBetween(runner, start, end)) {
            if (existing.getScheduledDate() != null) {
                recoveredDates.add(existing.getScheduledDate());
            }
        }
        return recoveredDates.size() >= days;
    }

    private CoachScheduledWorkout buildDefaultDay(Runner runner, LocalDate date) {
        CoachScheduledWorkout w = new CoachScheduledWorkout();
        w.setRunner(runner);
        w.setScheduledDate(date);
        w.setReadinessAdjusted(false);
        DayOfWeek dow = date.getDayOfWeek();
        if (dow == DayOfWeek.MONDAY || dow == DayOfWeek.FRIDAY) {
            w.setWorkoutType(CoachWorkoutType.REST);
        } else if (dow == DayOfWeek.WEDNESDAY) {
            w.setWorkoutType(CoachWorkoutType.INTERVALS);
            w.setPlannedDistanceKm(10.0);
            w.setPlannedDurationMinutes(60);
        } else if (dow == DayOfWeek.SUNDAY) {
            w.setWorkoutType(CoachWorkoutType.LONG_RUN);
            w.setPlannedDistanceKm(15.0);
            w.setPlannedDurationMinutes(90);
        } else {
            w.setWorkoutType(CoachWorkoutType.EASY);
            w.setPlannedDistanceKm(8.0);
            w.setPlannedDurationMinutes(45);
        }
        return w;
    }

    private void applyBlockLongRun(CoachTrainingBlock block, CoachScheduledWorkout w) {
        if (w.getWorkoutType() == CoachWorkoutType.LONG_RUN) {
            w.setPlannedDistanceKm(round1(block.getCurrentLongRunKm()));
            w.setPlannedDurationMinutes((int) (block.getCurrentLongRunKm() * 6.0));
        }
    }

    private void maybeAdvanceTrainingWeek(Runner runner, CoachTrainingBlock block) {
        LocalDate today = LocalDate.now();
        LocalDate nextWeekStart = block.getLastProgressionWeekStart().plusDays(7);
        if (!today.isBefore(nextWeekStart)) {
            block.setWeekIndex(block.getWeekIndex() + 1);
            block.setLastProgressionWeekStart(nextWeekStart);
            if (block.getWeekIndex() % 4 != 0) {
                block.setCurrentLongRunKm(round1(block.getCurrentLongRunKm() * LONG_RUN_WEEKLY_BUMP));
            } else {
                block.setCurrentLongRunKm(round1(block.getCurrentLongRunKm() * 0.7));
            }
            coachTrainingBlockRepository.save(block);
        }
    }

    private void apply8020ToTomorrow(Runner runner) {
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        coachScheduledWorkoutRepository.findByRunnerAndScheduledDate(runner, tomorrow).ifPresent(w -> {
            if (w.getWorkoutType() == CoachWorkoutType.INTERVALS || w.getWorkoutType() == CoachWorkoutType.THRESHOLD) {
                CoachRunnerState state = getOrCreateState(runner);
                if (state.getHighIntensityRatioLast7d() > HIGH_INTENSITY_WEEKLY_CAP) {
                    w.setMutatedFrom(w.getWorkoutType());
                    w.setWorkoutType(CoachWorkoutType.EASY);
                    w.setNotes("80/20 Guard: Too much intensity recently. Swapped to Easy.");
                    coachScheduledWorkoutRepository.save(w);
                }
            }
        });
    }

    private CoachScheduledWorkout applyReadinessGate(CoachRunnerState state, CoachScheduledWorkout workout) {
        if (workout.getWorkoutType() == CoachWorkoutType.REST || workout.isReadinessAdjusted()) return workout;

        Runner runner = state.getRunner() != null ? state.getRunner() : workout.getRunner();
        LocalDate readinessDate = workout.getScheduledDate() != null ? workout.getScheduledDate() : LocalDate.now();
        ReadinessService.ReadinessResult readiness = resolveReadiness(runner, state, readinessDate);
        state.setReadinessScore(readiness.score());
        state.setReadinessVerdict(readiness.verdict());
        coachRunnerStateRepository.save(state);

        if ("REST".equals(readiness.verdict())) {
            workout.setReadinessAdjusted(true);
            workout.setMutatedFrom(workout.getWorkoutType());
            workout.setWorkoutType(CoachWorkoutType.RECOVERY);
            workout.setNotes("Readiness score " + readiness.score() + "/100 (REST). Downgraded to Recovery.");
            if (workout.getPlannedDistanceKm() != null) workout.setPlannedDistanceKm(round1(workout.getPlannedDistanceKm() * 0.5));
            return workout;
        }

        if ("RECOVERY".equals(readiness.verdict())) {
            workout.setReadinessAdjusted(true);
            workout.setMutatedFrom(workout.getWorkoutType());
            if (workout.getWorkoutType() == CoachWorkoutType.INTERVALS || workout.getWorkoutType() == CoachWorkoutType.THRESHOLD) {
                workout.setWorkoutType(CoachWorkoutType.EASY);
                workout.setNotes("Readiness score " + readiness.score() + "/100 (RECOVERY). Downgraded to Easy.");
            } else {
                workout.setWorkoutType(CoachWorkoutType.RECOVERY);
                workout.setNotes("Readiness score " + readiness.score() + "/100 (RECOVERY). Shortened to Recovery.");
                if (workout.getPlannedDistanceKm() != null) workout.setPlannedDistanceKm(round1(workout.getPlannedDistanceKm() * 0.6));
            }
            return workout;
        }

        if ("EASY".equals(readiness.verdict())) {
            if (workout.getWorkoutType() == CoachWorkoutType.INTERVALS || workout.getWorkoutType() == CoachWorkoutType.THRESHOLD) {
                workout.setReadinessAdjusted(true);
                workout.setMutatedFrom(workout.getWorkoutType());
                workout.setWorkoutType(CoachWorkoutType.EASY);
                workout.setNotes("Readiness score " + readiness.score() + "/100 (EASY). Quality session softened to Easy.");
            }
        }

        return workout;
    }

    private CoachRunnerState getOrCreateState(Runner runner) {
        return coachRunnerStateRepository.findByRunner(runner).orElseGet(() -> {
            CoachRunnerState s = new CoachRunnerState();
            s.setRunner(runner);
            try {
                return coachRunnerStateRepository.save(s);
            } catch (DataIntegrityViolationException race) {
                return coachRunnerStateRepository.findByRunner(runner).orElseThrow(() -> race);
            }
        });
    }

    private double estimateSeedLongRunKm(Runner runner) {
        LocalDateTime now = LocalDateTime.now();
        List<RunMetricsProjection> recent = activityRepository.findRunMetricsBetween(runner, ActivityType.RUN, now.minusDays(30), now);
        double maxLong = recent.stream().mapToDouble(r -> (r.getDistanceKm() > 0) ? r.getDistanceKm() : (r.getDistanceMeters() / 1000.0)).max().orElse(10.0);
        return round1(Math.min(maxLong, 32));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static int resolveHrMax(Runner r, List<RunMetricsProjection> runs) {
        if (r.getMaxHeartRateBpm() != null && r.getMaxHeartRateBpm() > 120) return r.getMaxHeartRateBpm();
        double peak = runs.stream()
                .mapToDouble(run -> run.getMaxHeartRate() != null ? run.getMaxHeartRate() : 0.0)
                .max().orElse(0.0);
        if (peak > 140) return (int) Math.round(peak);
        return 190;
    }

    private static CoachScheduledWorkoutDto toScheduledDto(CoachScheduledWorkout w) {
        return new CoachScheduledWorkoutDto(
                w.getScheduledDate(), w.getWorkoutType().name(), w.getPlannedDistanceKm(),
                w.getPlannedDurationMinutes(), w.isStridesSuggested(), w.getNotes(),
                w.getMutatedFrom() != null ? w.getMutatedFrom().name() : null, w.isReadinessAdjusted()
        );
    }

private CoachStateDto toStateDto(Runner runner, CoachRunnerState s, CoachScheduledWorkout todayWorkout) {
        CoachStaminaDto stamina = buildStaminaDto(runner, s, todayWorkout);
        ReadinessService.ReadinessResult readiness = resolveReadiness(runner, s, LocalDate.now());
        return new CoachStateDto(
                s.getVolumeKm7d(), s.getVolumeKm28d(), s.getMinutesLowZ1Z2Last7d(),
                s.getMinutesGreyZ3Last7d(), s.getMinutesHighZ4Z5Last7d(), s.getMinutesUnknownHrLast7d(),
                s.getHighIntensityRatioLast7d(), s.isHighMileageGrinder(),
                s.getBaselineRestingHr(), s.getLastNightRestingHr(), s.getLastSleepScore(), s.getLastHrvMs(), s.getLastStressScore(),
                s.getLastHrvStatus(), s.getLastBodyBatteryAtWake(),
                s.getReadinessScore(), s.getReadinessVerdict(),
                readiness.sleepScore(), readiness.hrvScore(), readiness.rhrScore(), readiness.stressScore(),
                runner.getMaxHeartRateBpm(), runner.getRestingHeartRateBpm(), stamina,
                coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).map(b -> new CoachTrainingBlockDto(
                        b.getRaceDistanceKm(), b.getTargetRaceDate(), b.getWeekIndex(), b.getCurrentLongRunKm(), b.getName()
                )).orElse(null)
        );
    }

    private ReadinessService.ReadinessResult resolveReadiness(Runner runner, CoachRunnerState state, LocalDate date) {
        ReadinessService.MultiSourceReadinessSnapshot snapshot = readinessService.resolveReadinessSnapshot(runner, state, date);
        if (snapshot != null && snapshot.readiness() != null) {
            return snapshot.readiness();
        }
        int score = state.getReadinessScore() != null ? state.getReadinessScore() : 75;
        String verdict = state.getReadinessVerdict() != null ? state.getReadinessVerdict() : "GO";
        int sleep = state.getLastSleepScore() != null ? state.getLastSleepScore() : score;
        int stress = state.getLastStressScore() != null ? Math.max(0, 100 - state.getLastStressScore()) : score;
        return new ReadinessService.ReadinessResult(score, verdict, sleep, score, score, stress);
    }

    private CoachStaminaDto buildStaminaDto(Runner runner, CoachRunnerState state, CoachScheduledWorkout todayWorkout) {
        int recoveryCap = 100;
        Integer sleep = state.getLastSleepScore();
        if (sleep != null) {
            if (sleep < 60) recoveryCap -= 12;
            else if (sleep < 78) recoveryCap -= 5;
        }
        int score = recoveryCap;
        CoachWorkoutType type = todayWorkout != null ? todayWorkout.getWorkoutType() : null;
        if (type != null) {
            switch (type) {
                case LONG_RUN -> score -= 5;
                case TEMPO, THRESHOLD -> score -= 7;
                case INTERVALS -> score -= 9;
                default -> score -= 1;
            }
        }
        Integer targetPace = null;
        if (todayWorkout != null && todayWorkout.getPlannedDistanceKm() != null && todayWorkout.getPlannedDistanceKm() > 0
                && todayWorkout.getPlannedDurationMinutes() != null && todayWorkout.getPlannedDurationMinutes() > 0) {
            targetPace = (int) Math.round((todayWorkout.getPlannedDurationMinutes() * 60.0) / todayWorkout.getPlannedDistanceKm());
        }
        Double hrMax = state.getEstimatedHrMaxBpm() != null ? state.getEstimatedHrMaxBpm() : (runner.getMaxHeartRateBpm() != null ? runner.getMaxHeartRateBpm().doubleValue() : null);
        Integer targetHr = hrMax == null ? null : (int) Math.round(hrMax * 0.62);
        String direction = score < recoveryCap ? "down" : score > recoveryCap ? "up" : "steady";
        return new CoachStaminaDto(score, recoveryCap, targetPace, targetHr, direction);
    }

    private String inferScheduledSurface(CoachScheduledWorkout workout) {
        if (workout == null || workout.getNotes() == null) return null;
        String notes = workout.getNotes().toLowerCase(Locale.ROOT);
        if (notes.contains("trail")) return "trail";
        if (notes.contains("road")) return "road";
        return null;
    }

    private String recommendedShoeReason(CoachWorkoutType workoutType, String preferredSurface) {
        String workoutLabel = workoutType == null ? "today's run" : workoutType + " workout";
        if (preferredSurface == null || preferredSurface.isBlank()) {
            return "Best match for " + workoutLabel;
        }
        return "Best match for " + preferredSurface + " surface and " + workoutLabel;
    }

    // --- DTOs ---
    public record CoachStaminaDto(int scorePercent, int recoveryCapPercent, Integer targetPaceSecondsPerKm, Integer targetHeartRateBpm, String direction) {}

    public record CoachStateDto(
            double volumeKm7d, double volumeKm28d, int minutesLowZ1Z2Last7d,
            int minutesGreyZ3Last7d, int minutesHighZ4Z5Last7d, int minutesUnknownHrLast7d,
            Double highIntensityRatioLast7d, boolean highMileageGrinder,
            Integer baselineRestingHr, Integer lastNightRestingHr, Integer lastSleepScore, Integer lastHrvMs, Integer lastStressScore,
            String lastHrvStatus, Integer lastBodyBatteryAtWake,
            Integer readinessScore, String readinessVerdict,
            Integer readinessSleep, Integer readinessHrv, Integer readinessRhr, Integer readinessStress,
            Integer profileMaxHeartRateBpm, Integer profileRestingHeartRateBpm, CoachStaminaDto stamina,
            CoachTrainingBlockDto activeBlock
    ) {}

    public record CoachScheduledWorkoutDto(
            LocalDate scheduledDate, String workoutType, Double plannedDistanceKm,
            Integer plannedDurationMinutes, boolean stridesSuggested, String notes,
            String mutatedFrom, boolean readinessAdjusted
    ) {}

    public record CoachTrainingBlockDto(double raceDistanceKm, LocalDate targetRaceDate, int weekIndex, double currentLongRunKm, String name) {}

    public record CoachRecommendedShoeDto(
            Long id, String brand, String model, String nickname, String photoUrl,
            Double currentDistanceKm, Double maxDistanceKm, String type, String surfaceType,
            LocalDateTime lastWornAt, Integer daysSinceLastWear, String recommendationReason
    ) {}

    public record CoachTodayDto(
            CoachScheduledWorkoutDto today, CoachStateDto state,
            CoachRouteRecommendationDto routeRecommendation, CoachRecommendedShoeDto recommendedShoe
    ) {}

    public record CoachFeedbackAlertDto(Long id, String alertType, String message, LocalDateTime createdAt) {}
}
