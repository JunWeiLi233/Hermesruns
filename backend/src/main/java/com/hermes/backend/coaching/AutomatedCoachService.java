package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunMetricsProjection;
import com.hermes.backend.races.RaceEvent;
import com.hermes.backend.races.RaceEventRepository;
import com.hermes.backend.races.RaceRegistrationStatus;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.ShoeTrackerService;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ShoeTrackerService shoeTrackerService;
    private final CoachRouteService coachRouteService;
    private final ReadinessService readinessService;
    private final PersonalizedRunningPlanner personalizedRunningPlanner;
    private final RaceEventRepository raceEventRepository;
    private final InjuryRiskService injuryRiskService;
    private final Clock clock;

    // Optional, so tests that build the service by hand do not need it.
    private ApplicationEventPublisher zoneEvents;
    @Autowired(required = false)
    private com.hermes.backend.coaching.plan.RunPlanSelection versionedPlans;

    @Autowired(required = false)
    void setZoneEvents(ApplicationEventPublisher zoneEvents) {
        this.zoneEvents = zoneEvents;
    }

    public AutomatedCoachService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
            CoachTrainingBlockRepository coachTrainingBlockRepository,
            CoachFeedbackAlertRepository coachFeedbackAlertRepository,
            ShoeTrackerService shoeTrackerService,
            CoachRouteService coachRouteService,
            ReadinessService readinessService,
            PersonalizedRunningPlanner personalizedRunningPlanner,
            RaceEventRepository raceEventRepository,
            InjuryRiskService injuryRiskService
    ) {
        this(runnerRepository, activityRepository, coachRunnerStateRepository,
                coachScheduledWorkoutRepository, coachTrainingBlockRepository, coachFeedbackAlertRepository,
                shoeTrackerService, coachRouteService, readinessService, personalizedRunningPlanner,
                raceEventRepository, injuryRiskService, Clock.systemDefaultZone());
    }

    @Autowired
    public AutomatedCoachService(
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            CoachScheduledWorkoutRepository coachScheduledWorkoutRepository,
            CoachTrainingBlockRepository coachTrainingBlockRepository,
            CoachFeedbackAlertRepository coachFeedbackAlertRepository,
            ShoeTrackerService shoeTrackerService,
            CoachRouteService coachRouteService,
            ReadinessService readinessService,
            PersonalizedRunningPlanner personalizedRunningPlanner,
            RaceEventRepository raceEventRepository,
            InjuryRiskService injuryRiskService,
            Clock clock
    ) {
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.coachRunnerStateRepository = coachRunnerStateRepository;
        this.coachScheduledWorkoutRepository = coachScheduledWorkoutRepository;
        this.coachTrainingBlockRepository = coachTrainingBlockRepository;
        this.coachFeedbackAlertRepository = coachFeedbackAlertRepository;
        this.shoeTrackerService = shoeTrackerService;
        this.coachRouteService = coachRouteService;
        this.readinessService = readinessService;
        this.personalizedRunningPlanner = personalizedRunningPlanner;
        this.raceEventRepository = raceEventRepository;
        this.injuryRiskService = injuryRiskService;
        this.clock = java.util.Objects.requireNonNull(clock);
    }

    // The ingestion listener joins the import before commit; provider callbacks start a transaction.
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
        refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
    }

    @Transactional
    public void reaggregateRunner(Long runnerId) {
        runnerRepository.findById(runnerId).ifPresent(this::aggregateState);
    }

    @Transactional
    public void replanFutureSchedule(Runner runner) {
        if (runner != null) {
            refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
        }
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
                refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
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
        refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
        CoachScheduledWorkout todayWorkout = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDate(runner, LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))))
                .orElse(null);
        if (versionedPlans != null && versionedPlans.selected(runner)) todayWorkout = null;
        return toStateDto(runner, state, todayWorkout);
    }

    /**
     * Reads the current coach state without changing a runner's future
     * schedule. Manual run check-ins use this path so their explicit plan is
     * not replaced as a side effect of opening the strength planner.
     */
    @Transactional
    public CoachStateDto getCoachStatePreservingSchedule(Runner runner) {
        CoachRunnerState state = getOrCreateState(runner);
        if (state.getLastAggregatedAt() == null) {
            aggregateState(runner);
            state = coachRunnerStateRepository.findByRunner(runner).orElse(state);
        }
        CoachScheduledWorkout todayWorkout = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDate(runner, LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))))
                .orElse(null);
        return toStateDto(runner, state, todayWorkout);
    }

    @Transactional
    public List<CoachScheduledWorkoutDto> getSchedule(Runner runner, int days) {
        int d = Math.min(28, Math.max(1, days));
        PersonalizedRunningPlanner.PersonalizedPlan plan = refreshPersonalizedPlan(runner, Math.max(d, SCHEDULE_HORIZON_DAYS));
        if (versionedPlans != null && versionedPlans.selected(runner)) {
            LocalDate end = plan.today().date().plusDays(d - 1L);
            return plan.sessions().stream().filter(session -> !session.date().isAfter(end)).map(session -> {
                CoachScheduledWorkout row = new CoachScheduledWorkout(); row.setRunner(runner); applyPlannedSession(row, session);
                return toScheduledDto(row, session);
            }).toList();
        }
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        List<CoachScheduledWorkout> rows = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, today.plusDays(d - 1L));
        Map<LocalDate, PersonalizedRunningPlanner.PlannedSession> sessionsByDate = plan.sessions().stream()
                .collect(java.util.stream.Collectors.toMap(PersonalizedRunningPlanner.PlannedSession::date, session -> session));
        return rows.stream()
                .map(row -> toScheduledDto(recommendationRow(row, sessionsByDate.get(row.getScheduledDate())), sessionsByDate.get(row.getScheduledDate())))
                .toList();
    }

    /** Personalized library suggestions are computed on read; opening the library never schedules sessions. */
    @Transactional(readOnly = true)
    public CoachLibraryDto getWorkoutLibrary(Runner runner) {
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        var published = versionedPlans == null ? null : versionedPlans.legacy(runner, SCHEDULE_HORIZON_DAYS);
        var publishedSessions = published == null ? Map.<LocalDate, com.hermes.backend.coaching.plan.RunPlanSelection.LibrarySession>of()
                : versionedPlans.librarySessions(runner);
        var preferences = versionedPlans == null ? null : versionedPlans.libraryPreferences(runner, planDate(published, today));
        var goal = preferences != null && preferences.goal() != null ? preferences.goal() : resolvePlannerGoal(runner, today);
        PersonalizedRunningPlanner.PersonalizedPlan plan = published;
        var completed = completedMileage(runner, today);
        if (plan == null) {
            CoachRunnerState state = coachRunnerStateRepository.findByRunner(runner).orElseGet(() -> {
                CoachRunnerState empty = new CoachRunnerState(); empty.setRunner(runner); return empty;
            });
            var snapshot = readinessService.resolveReadinessSnapshot(runner, state, today);
            var readiness = resolveReadiness(snapshot, state);
            InjuryRiskService.InjuryRiskAssessment injury = null;
            try { injury = injuryRiskService.getRiskAssessment(runner); }
            catch (RuntimeException unavailable) { log.debug("Library injury evidence unavailable for runner {}", runner.getId()); }
            plan = personalizedRunningPlanner.plan(new PersonalizedRunningPlanner.PlannerInput(today, SCHEDULE_HORIZON_DAYS,
                    buildPlannerHistory(runner, state, today), readiness.score(), readiness.verdict(), snapshot != null && snapshot.hasSourceData(),
                    injury == null ? null : injury.risk(), injury == null ? null : injury.sorenessLevel(), goal, completed,
                    preferences == null ? null : preferences.availableRunDays()));
        }
        var workouts = plan.sessions().stream().filter(session -> session.workoutType() != CoachWorkoutType.REST
                && session.workoutType() != CoachWorkoutType.CROSS_TRAIN && !session.date().isBefore(planDate(published, today))
                && (!publishedSessions.containsKey(session.date()) || !Set.of("COMPLETED", "SKIPPED").contains(publishedSessions.get(session.date()).state()))
                && !(session.date().equals(today) && completed.getOrDefault(today, 0d) > 0)
                && (session.distanceKm() != null && session.distanceKm() > 0 || session.durationMinutes() != null && session.durationMinutes() > 0))
                .map(session -> {
                    CoachScheduledWorkout row = new CoachScheduledWorkout(); row.setRunner(runner); applyPlannedSession(row, session);
                    var dto = toScheduledDto(row, session);
                    var identity = publishedSessions.get(session.date());
                    if (identity == null) return dto;
                    String type = switch (identity.workoutType()) {
                        case "LONG" -> "LONG_RUN"; case "INTERVAL" -> "INTERVALS"; case "STEADY" -> "TEMPO"; case "EVENT" -> "RACE";
                        default -> identity.workoutType();
                    };
                    return new CoachScheduledWorkoutDto(dto.scheduledDate(), type, dto.plannedDistanceKm(), dto.plannedDurationMinutes(),
                            dto.stridesSuggested(), dto.notes(), dto.mutatedFrom(), dto.readinessAdjusted(), dto.phase(), dto.intent(),
                            dto.reasonCode(), dto.targetPaceMinSecondsPerKm(), dto.targetPaceMaxSecondsPerKm(), dto.originalDistanceKm());
                }).toList();
        var metadata = new CoachPlanDto(plan.phase(), plan.targetWeeklyKm(), plan.sessionsPerWeek(),
                plan.preferredRunDays().stream().map(java.time.DayOfWeek::name).toList(), plan.confidence(), plan.reasonCodes(),
                published != null ? versionedPlans.calendarZone(runner) : ActivityLocalDates.zoneOf(runner).getId(),
                plan.historyEvidence(), plan.weeklyBudgets(), null);
        return new CoachLibraryDto(workouts, metadata, published != null || preferences != null ? "CONFIRMED" : "HISTORY", goal,
                published != null, preferences == null ? null : preferences.planId());
    }

    private static LocalDate planDate(PersonalizedRunningPlanner.PersonalizedPlan published, LocalDate fallback) {
        return published == null ? fallback : published.today().date();
    }

    public record CoachLibraryDto(List<CoachScheduledWorkoutDto> workouts, CoachPlanDto plan,
            String availabilitySource, PersonalizedRunningPlanner.Goal goal, boolean activePlan, String setupPlanId) {}

    /**
     * Returns the persisted schedule as-is for callers that are presenting a
     * user-authored check-in. If no schedule exists yet, the normal planner
     * path initializes it before returning the rows.
     */
    @Transactional
    public List<CoachScheduledWorkoutDto> getSchedulePreservingSchedule(Runner runner, int days) {
        if (versionedPlans != null && versionedPlans.selected(runner)) return getSchedule(runner, days);
        int d = Math.min(28, Math.max(1, days));
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        List<CoachScheduledWorkout> rows = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, today.plusDays(d - 1L));
        if (rows == null || rows.isEmpty()) {
            return getSchedule(runner, d);
        }
        return rows.stream().map(AutomatedCoachService::toScheduledDto).toList();
    }

    @Transactional
    public CoachTodayDto getTodayWithReadiness(Runner runner) {
        return getTodayWithReadiness(runner, true);
    }

    @Transactional
    public CoachTodayDto getTodayWithReadiness(Runner runner, boolean includeRoute) {
        PersonalizedRunningPlanner.PersonalizedPlan plan = refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
        CoachRunnerState state = getOrCreateState(runner);
        LocalDate today = plan.today().date();
        LocalDate horizonEnd = today.plusDays(SCHEDULE_HORIZON_DAYS - 1L);
        List<CoachScheduledWorkout> rows = new ArrayList<>(coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, horizonEnd));
        boolean versioned = versionedPlans != null && versionedPlans.selected(runner);
        if (versioned) {
            rows.clear();
            for (var session : plan.sessions()) {
                CoachScheduledWorkout row = new CoachScheduledWorkout();
                row.setRunner(runner);
                applyPlannedSession(row, session);
                rows.add(row);
            }
        }
        CoachScheduledWorkout storedToday = rows.stream()
                .filter(existing -> today.equals(existing.getScheduledDate()))
                .findFirst()
                .orElseGet(() -> {
                    CoachScheduledWorkout w = new CoachScheduledWorkout();
                    w.setRunner(runner);
                    applyPlannedSession(w, plan.today());
                    CoachScheduledWorkout saved = versioned ? w : coachScheduledWorkoutRepository.save(w);
                    rows.add(0, saved);
                    return saved;
                });
        CoachScheduledWorkout adjusted = recommendationRow(storedToday, plan.today());
        // Analytics pages need coach data without reading the runner's GPS history.
        CoachRouteRecommendationDto routeRecommendation = includeRoute
                ? coachRouteService.buildRouteRecommendation(runner, adjusted, rows) : null;
        
        String preferredSurface = inferScheduledSurface(adjusted);
        CoachRecommendedShoeDto shoeRec = shoeTrackerService.recommendShoe(runner, adjusted.getWorkoutType(), preferredSurface)
                .map(s -> new CoachRecommendedShoeDto(
                        s.getId(), s.getBrand(), s.getModel(), s.getNickname(), s.getPhotoUrl(),
                        s.getCurrentDistanceKm(), s.getMaxDistanceKm(), s.getType(), s.getSurfaceType(),
                        s.getLastWornAt(), s.getDaysSinceLastWear(),
                        recommendedShoeReason(adjusted.getWorkoutType(), preferredSurface)
                ))
                .orElse(null);

        String runnerState = computeRunnerState(runner, state);
        String coachMessage = buildCoachMessage(state, adjusted, runnerState, runner);
        Map<LocalDate, PersonalizedRunningPlanner.PlannedSession> sessionsByDate = plan.sessions().stream()
                .collect(java.util.stream.Collectors.toMap(PersonalizedRunningPlanner.PlannedSession::date, session -> session));
        List<CoachScheduledWorkoutDto> weekSchedule;
        if (versioned) {
            weekSchedule = versionedPlans.weekSessions(runner).stream().map(session -> {
                CoachScheduledWorkout row = new CoachScheduledWorkout();
                row.setRunner(runner);
                applyPlannedSession(row, session);
                return toScheduledDto(row, session);
            }).toList();
        } else if (!plan.weeklySessions().isEmpty()) {
            weekSchedule = plan.weeklySessions().stream().map(session -> {
                CoachScheduledWorkout row = new CoachScheduledWorkout();
                row.setRunner(runner);
                applyPlannedSession(row, session);
                return toScheduledDto(row, session);
            }).toList();
        } else {
            LocalDate weekStart = WeeklyMileageBudget.monday(today);
            // Retain the saved target for past/completed days; today's recommendation may be rest after completion.
            weekSchedule = findScheduleRange(runner, weekStart, weekStart.plusDays(6)).stream()
                    .map(AutomatedCoachService::toScheduledDto).toList();
        }
        var todayDto = toScheduledDto(adjusted, plan.today());
        var schedule = rows.stream().sorted(Comparator.comparing(CoachScheduledWorkout::getScheduledDate))
                .map(row -> today.equals(row.getScheduledDate()) ? todayDto
                        : toScheduledDto(recommendationRow(row, sessionsByDate.get(row.getScheduledDate())), sessionsByDate.get(row.getScheduledDate())))
                .toList();
        Map<LocalDate, CoachScheduledWorkoutDto> currentByDate = new HashMap<>();
        schedule.forEach(day -> currentByDate.put(day.scheduledDate(), day));
        currentByDate.put(today, todayDto);
        // Historical comparison targets stay visible; today and future days use the same adjusted prescriptions as the schedule.
        weekSchedule = weekSchedule.stream().map(day -> {
            if (day.scheduledDate().isBefore(today)) return day;
            var current = currentByDate.get(day.scheduledDate());
            if (current != null) return current;
            var session = sessionsByDate.get(day.scheduledDate());
            if (session == null) return day;
            CoachScheduledWorkout row = new CoachScheduledWorkout();
            row.setRunner(runner);
            applyPlannedSession(row, session);
            return toScheduledDto(row, session);
        }).toList();
        return new CoachTodayDto(
                todayDto,
                toStateDto(runner, state, adjusted),
                routeRecommendation,
                shoeRec,
                runnerState,
                coachMessage,
                toPlanDto(plan, runner),
                schedule,
                weekSchedule
        );
    }

    @Transactional
    public CoachTodayDto setEasierToday(Runner runner, boolean enabled) {
        if (versionedPlans != null && versionedPlans.selected(runner)) {
            throw new IllegalArgumentException("Change a published workout through its training plan.");
        }
        CoachTodayDto current = getTodayWithReadiness(runner);
        LocalDate date = current.today().scheduledDate();
        if (findCompletedRunDates(runner, date, date).contains(date)) {
            throw new IllegalArgumentException("A completed session cannot be replanned.");
        }
        Double distance = current.today().plannedDistanceKm();
        if (enabled && (distance == null || !Double.isFinite(distance) || distance <= 0)) {
            throw new IllegalArgumentException("No running distance is available to reduce.");
        }
        CoachScheduledWorkout row = coachScheduledWorkoutRepository.findByRunnerAndScheduledDate(runner, date)
                .orElseThrow(() -> new IllegalArgumentException("Today's prescription is unavailable."));
        String notes = row.getNotes() == null ? "" : row.getNotes().replace(CoachPlanAdjustment.MARKER, "").strip();
        if (enabled) {
            if (notes.length() + CoachPlanAdjustment.MARKER.length() + 1 > 600) {
                throw new IllegalArgumentException("The workout note is too long to save this adjustment.");
            }
            notes = CoachPlanAdjustment.MARKER + "\n" + notes;
        }
        row.setNotes(notes);
        coachScheduledWorkoutRepository.save(row);
        return getTodayWithReadiness(runner);
    }

    /**
     * Detects the runner's persona for today's coaching:
     *  - "new"      = fewer than 3 logged runs total
     *  - "comeback" = last run > 14 days ago (or 28-day volume effectively zero)
     *  - "active"   = otherwise
     */
    private String computeRunnerState(Runner runner, CoachRunnerState state) {
        long totalRuns = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        if (totalRuns < 3) {
            return "new";
        }
        List<RunMetricsProjection> last14 = findRecentRuns(runner, 14);
        if (last14.isEmpty() || state.getVolumeKm28d() <= 0.05) {
            return "comeback";
        }
        return "active";
    }

    /**
     * Builds a concise, specific, data-backed coaching sentence for today.
     * Uses already-aggregated state (volumes, readiness) and today's workout.
     */
    private String buildCoachMessage(CoachRunnerState state, CoachScheduledWorkout today, String runnerState, Runner runner) {
        if ("new".equals(runnerState)) {
            return "Start easy: run 30–40 minutes at a pace where you can hold a full conversation. We'll calibrate your zones after a few sessions.";
        }
        if ("comeback".equals(runnerState)) {
            long daysSinceLast = daysSinceLastRun(runner);
            if (daysSinceLast > 0) {
                return String.format(Locale.ROOT,
                        "Welcome back — %d days since your last run. Ease in at conversational pace for 25–35 minutes, and hold off on intensity for the first week.",
                        daysSinceLast);
            }
            return "Welcome back. Ease in at conversational pace for 25–35 minutes, and hold off on intensity for the first week.";
        }

        // Active runner — specific data-backed message.
        CoachWorkoutType type = today != null ? today.getWorkoutType() : null;
        double vol7 = state.getVolumeKm7d();
        double vol28 = state.getVolumeKm28d();
        // ACWR ≈ acute (7d) / chronic (28d/4 weekly average)
        Double acwr = null;
        if (vol28 > 0.1) {
            double chronicWeekly = vol28 / 4.0;
            if (chronicWeekly > 0.1) {
                acwr = Math.round((vol7 / chronicWeekly) * 100.0) / 100.0;
            }
        }
        String acwrClause = (acwr != null && acwr > 0) ? String.format(Locale.ROOT, " (ACWR %.2f)", acwr) : "";
        Integer readiness = state.getReadinessScore();
        String verdict = state.getReadinessVerdict();

        if (type == CoachWorkoutType.REST) {
            return String.format(Locale.ROOT,
                    "Rest day%s — recovery is training. %.0f km in the last 7 days is solid work.",
                    acwrClause, vol7);
        }

        String paceClause = buildEasyPaceClause(state, runner, type);
        String workoutLabel = describeWorkout(type);
        Double dist = today != null ? today.getPlannedDistanceKm() : null;
        String distClause = (dist != null && dist > 0) ? String.format(Locale.ROOT, " for %.0f km", dist) : "";
        String readinessClause = (readiness != null && verdict != null && !"GO".equals(verdict))
                ? String.format(Locale.ROOT, " Readiness %d/100 (%s) — listen to your body.", readiness, verdict)
                : "";

        return String.format(Locale.ROOT, "%s%s%s.%s%s",
                workoutLabel, acwrClause, distClause, paceClause, readinessClause);
    }

    private long daysSinceLastRun(Runner runner) {
        Instant now = clock.instant();
        List<RunMetricsProjection> recent = findRecentRuns(runner, 365);
        Instant latest = null;
        for (RunMetricsProjection r : recent) {
            Instant ts = runInstant(r, runner);
            if (ts != null && (latest == null || ts.isAfter(latest))) {
                latest = ts;
            }
        }
        if (latest == null) return 0;
        return java.time.Duration.between(latest, now).toDays();
    }

    private String describeWorkout(CoachWorkoutType type) {
        if (type == null) return "Easy run today";
        return switch (type) {
            case EASY -> "Easy run today";
            case LONG_RUN -> "Long run today";
            case INTERVALS -> "Quality day — intervals";
            case THRESHOLD -> "Quality day — threshold";
            case TEMPO -> "Tempo day";
            case RECOVERY -> "Recovery shakeout";
            case REST -> "Rest day";
            default -> "Run today";
        };
    }

    /**
     * Builds a coarse easy/target pace clause from recent average pace.
     * Falls back to a conservative range when no usable pace data exists.
     */
    private String buildEasyPaceClause(CoachRunnerState state, Runner runner, CoachWorkoutType type) {
        if (type == CoachWorkoutType.INTERVALS || type == CoachWorkoutType.THRESHOLD || type == CoachWorkoutType.TEMPO) {
            return ""; // quality sessions carry their own pace guidance elsewhere
        }
        List<RunMetricsProjection> last28 = findRecentRuns(runner, 28);
        double totalKm = 0, totalSec = 0;
        for (RunMetricsProjection r : last28) {
            double km = (r.getDistanceKm() > 0) ? r.getDistanceKm() : (r.getDistanceMeters() / 1000.0);
            Long dur = r.getDurationSeconds();
            if (km > 1.0 && dur != null && dur > 60) {
                totalKm += km;
                totalSec += dur;
            }
        }
        if (totalKm <= 0 || totalSec <= 0) {
            return " Aim for conversational pace.";
        }
        int avgPaceSec = (int) Math.round(totalSec / totalKm);
        // Easy zone: ~+30s to +75s/km slower than recent rolling average pace.
        int slow = avgPaceSec + 75;
        int fast = avgPaceSec + 30;
        return String.format(Locale.ROOT, " Target %d:%02d–%d:%02d/km.",
                fast / 60, fast % 60, slow / 60, slow % 60);
    }

    @Transactional
    public void logRecoveryMetrics(Runner runner, Integer restingHr, Integer sleepScore, Integer hrvMs, Integer stressScore) {
        readinessService.recordManualRecovery(runner, LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))),
                restingHr != null && restingHr > 30 && restingHr < 120 ? restingHr : null,
                sleepScore != null && sleepScore >= 0 && sleepScore <= 100 ? sleepScore : null,
                hrvMs != null && hrvMs > 0 && hrvMs < 5000 ? hrvMs : null,
                stressScore != null && stressScore >= 0 && stressScore <= 100 ? stressScore : null);
        CoachRunnerState state = getOrCreateState(runner);
        if (restingHr != null && restingHr > 30 && restingHr < 120) state.setLastNightRestingHr(restingHr);
        if (sleepScore != null && sleepScore >= 0 && sleepScore <= 100) state.setLastSleepScore(sleepScore);
        if (hrvMs != null && hrvMs >= 0 && hrvMs < 5000) state.setLastHrvMs(hrvMs);
        if (stressScore != null && stressScore >= 0 && stressScore <= 100) state.setLastStressScore(stressScore);
        state.setLastRecoveryLoggedAt(LocalDateTime.now(clock));
        coachRunnerStateRepository.save(state);
        refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
    }

    @Transactional
    public void updateCoachProfile(Runner runner, Integer maxHr, Integer restingHr) {
        boolean zonesChange = false;
        if (maxHr != null) {
            if (maxHr < 120 || maxHr > 230) throw new IllegalArgumentException("maxHeartRateBpm out of range.");
            zonesChange = !maxHr.equals(runner.getMaxHeartRateBpm());
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
        if (zonesChange && zoneEvents != null) {
            // The max heart rate also sets the heart-rate zones, so the runs analysed with the old one are redone.
            zoneEvents.publishEvent(new com.hermes.backend.runner.RunnerZonesChangedEvent(runner.getId()));
        }
    }

    @Transactional
    public CoachTrainingBlock startTrainingBlock(Runner runner, double raceDistanceKm, LocalDate targetRaceDate, String name) {
        if (versionedPlans != null && versionedPlans.selected(runner)) {
            throw new IllegalArgumentException("Review changes through the selected training plan.");
        }
        coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> {
            b.setActive(false);
            coachTrainingBlockRepository.save(b);
        });
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
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
        refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
        return saved;
    }

    @Transactional
    public void stopTrainingBlock(Runner runner) {
        coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).ifPresent(b -> {
            b.setActive(false);
            coachTrainingBlockRepository.save(b);
        });
        refreshPersonalizedPlan(runner, SCHEDULE_HORIZON_DAYS);
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
        Instant now = clock.instant();
        Instant from7 = now.minus(7, ChronoUnit.DAYS);
        Instant from28 = now.minus(28, ChronoUnit.DAYS);

        List<RunMetricsProjection> runs90 = findRecentRuns(runner, 90);
        double hrMax = resolveHrMax(runner, runs90);

        int low = 0, grey = 0, high = 0, unknown = 0;
        double vol7 = 0, vol28 = 0;
        for (RunMetricsProjection a : runs90) {
            Instant ts = runInstant(a, runner);
            if (ts == null) continue;
            // Duration/RPE-only sessions have no measured distance. Exclude them from this
            // distance-based legacy summary; the training workspace retains their RPE load.
            if ((a.getDistanceKm() == null || a.getDistanceKm() <= 0)
                    && (a.getDistanceMeters() == null || a.getDistanceMeters() <= 0)) continue;
            double dist = (a.getDistanceKm() != null && a.getDistanceKm() > 0)
                    ? a.getDistanceKm() : a.getDistanceMeters() / 1000.0;
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
        state.setLastAggregatedAt(LocalDateTime.now(clock));
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
                alert.setCreatedAt(LocalDateTime.now(clock));
                coachFeedbackAlertRepository.save(alert);
            }
        }
    }

    private PersonalizedRunningPlanner.PersonalizedPlan refreshPersonalizedPlan(Runner runner, int days) {
        if (versionedPlans != null) {
            var selected = versionedPlans.legacy(runner, days);
            if (selected != null) return selected;
        }
        LocalDate today = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        int horizonDays = Math.min(28, Math.max(1, days));
        LocalDate horizonEnd = today.plusDays(horizonDays - 1L);
        CoachRunnerState state = getOrCreateState(runner);
        if (state.getLastAggregatedAt() == null) {
            aggregateState(runner);
            state = coachRunnerStateRepository.findByRunner(runner).orElse(state);
        }

        ReadinessService.MultiSourceReadinessSnapshot readinessSnapshot =
                readinessService.resolveReadinessSnapshot(runner, state, today);
        ReadinessService.ReadinessResult readiness = resolveReadiness(readinessSnapshot, state);
        state.setReadinessScore(readiness.score());
        state.setReadinessVerdict(readiness.verdict());

        InjuryRiskService.InjuryRiskAssessment injuryAssessment = null;
        try {
            injuryAssessment = injuryRiskService.getRiskAssessment(runner);
        } catch (RuntimeException riskFailure) {
            log.debug("Personalized planner could not resolve injury risk for runner {}: {}", runner.getId(), riskFailure.getMessage());
        }

        var history = buildPlannerHistory(runner, state, today);
        state.setVolumeKm7d(history.volume7Km());
        state.setVolumeKm28d(history.volume28Km());
        state.setHighIntensityRatioLast7d(history.highIntensitySupported() ? history.highIntensityRatio7d() : null);
        state.setLastAggregatedAt(LocalDateTime.now(clock));
        coachRunnerStateRepository.save(state);
        PersonalizedRunningPlanner.PlannerInput plannerInput = new PersonalizedRunningPlanner.PlannerInput(
                today,
                horizonDays,
                history,
                readiness.score(),
                readiness.verdict(),
                readinessSnapshot != null && readinessSnapshot.hasSourceData(),
                injuryAssessment == null ? null : injuryAssessment.risk(),
                injuryAssessment == null ? null : injuryAssessment.sorenessLevel(),
                resolvePlannerGoal(runner, today),
                completedMileage(runner, today)
        );
        PersonalizedRunningPlanner.PersonalizedPlan plan = personalizedRunningPlanner.plan(plannerInput);

        synchronized (scheduleHorizonLocks.computeIfAbsent(runner.getId(), ignored -> new Object())) {
            Set<LocalDate> completedRunDates = findCompletedRunDates(runner, today, horizonEnd);
            Map<LocalDate, CoachScheduledWorkout> existingByDate = new HashMap<>();
            for (CoachScheduledWorkout existing : findScheduleRange(runner, today, horizonEnd)) {
                if (existing.getScheduledDate() != null) {
                    existingByDate.put(existing.getScheduledDate(), existing);
                }
            }

            CoachScheduledWorkout currentRow = existingByDate.get(today);
            if (currentRow != null && currentRow.getNotes() != null
                    && currentRow.getNotes().contains(CoachPlanAdjustment.MARKER)
                    && !completedRunDates.contains(today)) {
                plan = CoachPlanAdjustment.easeToday(plan);
            }

            List<CoachScheduledWorkout> toSave = new ArrayList<>();
            for (PersonalizedRunningPlanner.PlannedSession session : plan.sessions()) {
                CoachScheduledWorkout workout = existingByDate.get(session.date());
                if (workout != null && completedRunDates.contains(session.date())) {
                    continue;
                }
                // These rows are planner-owned. Reassess automatic rest as inputs
                // change; completed runs and explicit check-in reads stay preserved.
                if (workout == null) {
                    workout = new CoachScheduledWorkout();
                    workout.setRunner(runner);
                }
                applyPlannedSession(workout, session);
                toSave.add(workout);
            }

            if (!toSave.isEmpty()) {
                try {
                    coachScheduledWorkoutRepository.saveAll(toSave);
                } catch (DataIntegrityViolationException race) {
                    long persistedDates = coachScheduledWorkoutRepository
                            .findByRunnerAndScheduledDateBetween(runner, today, horizonEnd)
                            .stream()
                            .map(CoachScheduledWorkout::getScheduledDate)
                            .filter(java.util.Objects::nonNull)
                            .distinct()
                            .count();
                    if (persistedDates < horizonDays) {
                        throw race;
                    }
                    log.debug("Recovered personalized coach schedule race for runner {}", runner.getId());
                }
            }
        }
        return plan;
    }

    private List<CoachScheduledWorkout> findScheduleRange(Runner runner, LocalDate start, LocalDate end) {
        List<CoachScheduledWorkout> ordered = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, start, end);
        if (ordered != null && !ordered.isEmpty()) return ordered;
        List<CoachScheduledWorkout> fallback = coachScheduledWorkoutRepository
                .findByRunnerAndScheduledDateBetween(runner, start, end);
        return fallback == null ? List.of() : fallback;
    }

    private Map<LocalDate, Double> completedMileage(Runner runner, LocalDate today) {
        Map<LocalDate, Double> mileage = new java.util.TreeMap<>();
        for (var run : findRecentRuns(runner, 35)) {
            LocalDate date = runDate(run, runner);
            double km = distanceKm(run);
            if (!date.isAfter(today) && Double.isFinite(km) && km > 0) mileage.merge(date, km, Double::sum);
        }
        return Map.copyOf(mileage);
    }

    private CoachScheduledWorkout recommendationRow(CoachScheduledWorkout row, PersonalizedRunningPlanner.PlannedSession session) {
        if (session == null || !"run_completed".equals(session.reasonCode())) return row;
        CoachScheduledWorkout view = new CoachScheduledWorkout();
        view.setRunner(row.getRunner());
        view.setNotes(row.getNotes());
        applyPlannedSession(view, session);
        return view;
    }

    private Set<LocalDate> findCompletedRunDates(Runner runner, LocalDate start, LocalDate end) {
        List<RunMetricsProjection> completedRuns = activityRepository.findRunMetricsBetween(
                runner,
                ActivityType.RUN,
                start.minusDays(1).atStartOfDay(),
                end.plusDays(2).atStartOfDay()
        );
        if (completedRuns == null || completedRuns.isEmpty()) return Set.of();
        Set<LocalDate> dates = new HashSet<>();
        for (RunMetricsProjection run : completedRuns) {
            if (run.getEffectiveStartTime() == null) continue;
            LocalDate date = runDate(run, runner);
            if (!date.isBefore(start) && !date.isAfter(end)) dates.add(date);
        }
        return dates;
    }

    private PersonalizedRunningPlanner.RunHistory buildPlannerHistory(Runner runner, CoachRunnerState state, LocalDate today) {
        Instant now = clock.instant();
        List<RunMetricsProjection> runs = findRecentRuns(runner, 90);

        LocalDate from28 = today.minusDays(27);
        LocalDate from7 = today.minusDays(6);
        Set<LocalDate> runDates28 = new HashSet<>();
        Map<DayOfWeek, Integer> preferredDayCounts = new EnumMap<>(DayOfWeek.class);
        double volume7 = 0;
        double volume28 = 0;
        double duration28Seconds = 0;
        double timedDistance28 = 0;
        int timedRunCount28 = 0;
        double knownSeconds7 = 0;
        double highSeconds7 = 0;
        double lowSeconds7 = 0;
        double greySeconds7 = 0;
        double unknownSeconds7 = 0;
        double longest28 = 0;
        Instant latestRunAt = null;
        Instant latestHardAt = null;
        LocalDate latestRunDate = null;
        int resolvedHrMax = resolveHrMax(runner, runs);

        for (RunMetricsProjection run : runs) {
            Instant startedAt = runInstant(run, runner);
            if (startedAt == null) continue;
            LocalDate runDate = runDate(run, runner);
            double distanceKm = distanceKm(run);
            if (!Double.isFinite(distanceKm) || distanceKm <= 0) continue;
            long durationSeconds = durationSeconds(run);
            if (latestRunAt == null || startedAt.isAfter(latestRunAt)) {
                latestRunAt = startedAt;
                latestRunDate = runDate;
            }

            if (!runDate.isBefore(from28) && !runDate.isAfter(today)) {
                volume28 += distanceKm;
                longest28 = Math.max(longest28, distanceKm);
                runDates28.add(runDate);
                preferredDayCounts.merge(runDate.getDayOfWeek(), 1, Integer::sum);
                timedRunCount28++;
                if (durationSeconds > 0) { duration28Seconds += durationSeconds; timedDistance28 += distanceKm; }
            }
            if (!runDate.isBefore(from7) && !runDate.isAfter(today)) {
                volume7 += distanceKm;
                Double peak = run.getMaxHeartRate();
                if (peak != null && peak > 0 && resolvedHrMax > 0) {
                    knownSeconds7 += durationSeconds;
                    if (peak / resolvedHrMax >= 0.88) highSeconds7 += durationSeconds;
                    else if (peak / resolvedHrMax >= 0.80) greySeconds7 += durationSeconds;
                    else lowSeconds7 += durationSeconds;
                } else unknownSeconds7 += durationSeconds;
            }

            Double maxHr = run.getMaxHeartRate();
            boolean highHr = maxHr != null && resolvedHrMax > 0 && maxHr / resolvedHrMax >= 0.88;
            boolean hard = highHr || distanceKm >= 16 || durationSeconds >= 90 * 60L;
            if (hard && (latestHardAt == null || startedAt.isAfter(latestHardAt))) latestHardAt = startedAt;
        }

        long totalRuns = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        double averageRunKm = timedRunCount28 == 0 ? 0 : volume28 / timedRunCount28;
        double averagePace = timedDistance28 > 0 && duration28Seconds > 0 ? duration28Seconds / timedDistance28 : 0;
        state.setMinutesLowZ1Z2Last7d((int) (lowSeconds7 / 60));
        state.setMinutesGreyZ3Last7d((int) (greySeconds7 / 60));
        state.setMinutesHighZ4Z5Last7d((int) (highSeconds7 / 60));
        state.setMinutesUnknownHrLast7d((int) (unknownSeconds7 / 60));
        Integer hoursSinceHard = latestHardAt == null ? null : Math.max(0, (int) Duration.between(latestHardAt, now).toHours());
        Integer daysSinceLast = latestRunDate == null ? null : Math.max(0, (int) ChronoUnit.DAYS.between(latestRunDate, today));

        return new PersonalizedRunningPlanner.RunHistory(
                (int) Math.min(Integer.MAX_VALUE, totalRuns),
                runDates28.size(),
                round1(volume7),
                round1(volume28),
                round1(averageRunKm),
                round1(longest28),
                round1(averagePace),
                knownSeconds7 > 0 ? highSeconds7 / knownSeconds7 : 0,
                hoursSinceHard,
                daysSinceLast,
                Map.copyOf(preferredDayCounts), knownSeconds7 > 0
        );
    }

    private PersonalizedRunningPlanner.Goal resolvePlannerGoal(Runner runner, LocalDate today) {
        Optional<CoachTrainingBlock> block = coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner);
        if (block.isPresent()) {
            CoachTrainingBlock active = block.get();
            return new PersonalizedRunningPlanner.Goal(
                    active.getRaceDistanceKm(),
                    active.getTargetRaceDate(),
                    null,
                    active.getName()
            );
        }

        List<RaceEvent> races = raceEventRepository.findByRunnerOrderByEventDateAsc(runner);
        if (races == null) races = List.of();
        return races.stream()
                .filter(race -> race.getEventDate() != null && !race.getEventDate().isBefore(today))
                .filter(race -> race.getRegistrationStatus() != RaceRegistrationStatus.CANCELED)
                .filter(race -> race.getRegistrationStatus() != RaceRegistrationStatus.COMPLETED)
                .min(Comparator.comparing(RaceEvent::getEventDate))
                .map(race -> new PersonalizedRunningPlanner.Goal(
                        race.getDistanceKm(),
                        race.getEventDate(),
                        race.getGoalTimeSeconds(),
                        race.getName()
                ))
                .orElse(null);
    }

    private void applyPlannedSession(CoachScheduledWorkout workout, PersonalizedRunningPlanner.PlannedSession session) {
        workout.setScheduledDate(session.date());
        workout.setWorkoutType(session.workoutType());
        workout.setPlannedDistanceKm(session.distanceKm());
        workout.setPlannedDurationMinutes(session.durationMinutes());
        workout.setStridesSuggested(session.stridesSuggested());
        workout.setMutatedFrom(session.mutatedFrom());
        workout.setReadinessAdjusted(session.readinessAdjusted());
    }

    private double distanceKm(RunMetricsProjection run) {
        if (run.getDistanceKm() != null && run.getDistanceKm() > 0) return run.getDistanceKm();
        return run.getDistanceMeters() != null && run.getDistanceMeters() > 0 ? run.getDistanceMeters() / 1000.0 : 0;
    }

    private long durationSeconds(RunMetricsProjection run) {
        if (run.getMovingTimeSeconds() != null && run.getMovingTimeSeconds() > 0) return run.getMovingTimeSeconds();
        return run.getDurationSeconds() != null && run.getDurationSeconds() > 0 ? run.getDurationSeconds() : 0;
    }

    private CoachScheduledWorkout buildDefaultDay(Runner runner, LocalDate date) {
        CoachScheduledWorkout w = new CoachScheduledWorkout();
        w.setRunner(runner);
        w.setScheduledDate(date);
        w.setReadinessAdjusted(false);
        w.setWorkoutType(CoachWorkoutType.EASY);
        w.setPlannedDistanceKm(5.0);
        w.setPlannedDurationMinutes(30);
        return w;
    }

    private void applyBlockLongRun(CoachTrainingBlock block, CoachScheduledWorkout w) {
        if (w.getWorkoutType() == CoachWorkoutType.LONG_RUN) {
            w.setPlannedDistanceKm(round1(block.getCurrentLongRunKm()));
            w.setPlannedDurationMinutes((int) (block.getCurrentLongRunKm() * 6.0));
        }
    }

    private void maybeAdvanceTrainingWeek(Runner runner, CoachTrainingBlock block) {
        LocalDate currentWeekStart = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate lastWeekStart = block.getLastProgressionWeekStart();
        if (lastWeekStart == null) {
            // Recover calendar position without treating an unknown history as completed training.
            LocalDate startedOn = block.getBlockStartedOn();
            if (startedOn != null && !startedOn.isAfter(currentWeekStart)) {
                long elapsedWeeks = ChronoUnit.WEEKS.between(
                        startedOn.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), currentWeekStart);
                block.setWeekIndex((int) Math.min(Integer.MAX_VALUE, Math.max(block.getWeekIndex(), elapsedWeeks)));
            }
            block.setLastProgressionWeekStart(currentWeekStart);
            coachTrainingBlockRepository.save(block);
            return;
        }

        long elapsedWeeks = ChronoUnit.WEEKS.between(lastWeekStart, currentWeekStart);
        if (elapsedWeeks <= 0) return;

        block.setWeekIndex((int) Math.min(Integer.MAX_VALUE, (long) block.getWeekIndex() + elapsedWeeks));
        block.setLastProgressionWeekStart(currentWeekStart);
        // A multiweek gap proves elapsed time, not attendance. Keep the last load target.
        if (elapsedWeeks == 1) {
            if (block.getWeekIndex() % 4 != 0) {
                block.setCurrentLongRunKm(round1(block.getCurrentLongRunKm() * LONG_RUN_WEEKLY_BUMP));
            } else {
                block.setCurrentLongRunKm(round1(block.getCurrentLongRunKm() * 0.7));
            }
        }
        coachTrainingBlockRepository.save(block);
    }

    private void apply8020ToTomorrow(Runner runner) {
        LocalDate tomorrow = LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))).plusDays(1);
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
        LocalDate readinessDate = workout.getScheduledDate() != null ? workout.getScheduledDate() : LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner)));
        ReadinessService.ReadinessResult readiness = resolveReadiness(runner, state, readinessDate);
        state.setReadinessScore(readiness.score());
        state.setReadinessVerdict(readiness.verdict());
        coachRunnerStateRepository.save(state);
        // When recovery-data coverage is thin the verdict leans on the
        // training-load proxy; say so instead of implying wearable evidence.
        String basis = readiness.confidence() < 50
                ? " Based on training-load proxy (limited recovery data)."
                : "";

        if ("REST".equals(readiness.verdict())) {
            workout.setReadinessAdjusted(true);
            workout.setMutatedFrom(workout.getWorkoutType());
            workout.setWorkoutType(CoachWorkoutType.RECOVERY);
            workout.setNotes("Readiness score " + readiness.score() + "/100 (REST)." + basis);
            if (workout.getPlannedDistanceKm() != null) workout.setPlannedDistanceKm(round1(workout.getPlannedDistanceKm() * 0.5));
            return workout;
        }

        if ("RECOVERY".equals(readiness.verdict())) {
            workout.setReadinessAdjusted(true);
            workout.setMutatedFrom(workout.getWorkoutType());
            if (workout.getWorkoutType() == CoachWorkoutType.INTERVALS || workout.getWorkoutType() == CoachWorkoutType.THRESHOLD) {
                workout.setWorkoutType(CoachWorkoutType.EASY);
                workout.setNotes("Readiness score " + readiness.score() + "/100 (RECOVERY). Downgraded to Easy." + basis);
            } else {
                workout.setWorkoutType(CoachWorkoutType.RECOVERY);
                workout.setNotes("Readiness score " + readiness.score() + "/100 (RECOVERY). Shortened to Recovery." + basis);
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
        Optional<CoachRunnerState> existing = coachRunnerStateRepository.findByRunner(runner);
        if (existing.isPresent()) return existing.get();
        // Serialize first-use initialization until commit, including across app instances.
        // Retrying a unique-key failure inside the same Hibernate session cannot recover it.
        runnerRepository.findByIdForUpdate(runner.getId());
        return coachRunnerStateRepository.findByRunner(runner).orElseGet(() -> {
            CoachRunnerState s = new CoachRunnerState();
            s.setRunner(runner);
            return coachRunnerStateRepository.save(s);
        });
    }

    private double estimateSeedLongRunKm(Runner runner) {
        List<RunMetricsProjection> recent = findRecentRuns(runner, 30);
        double maxLong = recent.stream().mapToDouble(r -> (r.getDistanceKm() > 0) ? r.getDistanceKm() : (r.getDistanceMeters() / 1000.0)).max().orElse(10.0);
        return round1(Math.min(maxLong, 32));
    }

    private static LocalDate runDate(RunMetricsProjection run, Runner runner) {
        return run.getStartTime() == null ? run.getEffectiveStartTime().toLocalDate()
                : ActivityLocalDates.of(run.getStartTime(), Boolean.TRUE.equals(run.getStravaApiSourced()), runner);
    }

    private static Instant runInstant(RunMetricsProjection run, Runner runner) {
        LocalDateTime timestamp = run.getEffectiveStartTime();
        if (timestamp == null) return null;
        ZoneId zone = run.getStartTime() == null ? ZoneId.systemDefault()
                : Boolean.TRUE.equals(run.getStravaApiSourced()) ? ActivityLocalDates.zoneOf(runner) : ZoneOffset.UTC;
        return timestamp.atZone(zone).toInstant();
    }

    private List<RunMetricsProjection> findRecentRuns(Runner runner, int days) {
        Instant end = clock.instant();
        Instant start = end.minus(days, ChronoUnit.DAYS);
        // Stored file times are UTC; Strava clock times are local. Retrieve both, then apply
        // the actual rolling window without assuming the server shares the account's zone.
        List<RunMetricsProjection> rows = activityRepository.findRunMetricsBetween(runner, ActivityType.RUN,
                LocalDateTime.ofInstant(start, ZoneOffset.UTC).minusDays(1),
                LocalDateTime.ofInstant(end, ZoneOffset.UTC).plusDays(1));
        if (rows == null) return List.of();
        return rows.stream().filter(run -> {
            Instant timestamp = runInstant(run, runner);
            return timestamp != null && !timestamp.isBefore(start) && !timestamp.isAfter(end);
        }).toList();
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
        return toScheduledDto(w, null);
    }

    private static CoachScheduledWorkoutDto toScheduledDto(
            CoachScheduledWorkout w,
            PersonalizedRunningPlanner.PlannedSession session
    ) {
        // Completed rows can be preserved while the planner produces a different session.
        // Only attach evidence/pace belonging to the workout actually returned to the client.
        if (session != null && (!java.util.Objects.equals(w.getScheduledDate(), session.date())
                || w.getWorkoutType() != session.workoutType()
                || !java.util.Objects.equals(w.getPlannedDistanceKm(), session.distanceKm())
                || !java.util.Objects.equals(w.getPlannedDurationMinutes(), session.durationMinutes())
                || w.isStridesSuggested() != session.stridesSuggested()
                || w.getMutatedFrom() != session.mutatedFrom()
                || w.isReadinessAdjusted() != session.readinessAdjusted())) {
            session = null;
        }
        return new CoachScheduledWorkoutDto(
                w.getScheduledDate(), w.getWorkoutType().name(), w.getPlannedDistanceKm(),
                w.getPlannedDurationMinutes(), w.isStridesSuggested(), visibleWorkoutNotes(w.getNotes()),
                w.getMutatedFrom() != null ? w.getMutatedFrom().name() : null, w.isReadinessAdjusted(),
                session != null ? session.phase() : null,
                session != null ? session.intent() : null,
                session != null ? session.reasonCode() : null,
                session != null ? session.targetPaceMinSecondsPerKm() : null,
                session != null ? session.targetPaceMaxSecondsPerKm() : null,
                session != null ? session.originalDistanceKm() : null
        );
    }

    private CoachPlanDto toPlanDto(PersonalizedRunningPlanner.PersonalizedPlan plan, Runner runner) {
        return new CoachPlanDto(
                plan.phase(),
                plan.targetWeeklyKm(),
                plan.sessionsPerWeek(),
                plan.preferredRunDays().stream().map(DayOfWeek::name).toList(),
                plan.confidence(),
                plan.reasonCodes(),
                versionedPlans == null ? ActivityLocalDates.zoneOf(runner).getId() : versionedPlans.calendarZone(runner),
                plan.historyEvidence(), plan.weeklyBudgets(),
                ReadinessService.RecoveryEvidence.from(plan.today().date(), readinessService.resolveReadinessSnapshot(
                        runner, getOrCreateState(runner), plan.today().date()))
        );
    }

    private static String visibleWorkoutNotes(String notes) {
        if (notes == null) return null;
        String visible = notes.replace(CoachPlanAdjustment.MARKER, "").strip();
        return visible.isBlank() ? null : visible;
    }

    private CoachStateDto toStateDto(Runner runner, CoachRunnerState s, CoachScheduledWorkout todayWorkout) {
        ReadinessService.MultiSourceReadinessSnapshot snapshot =
                readinessService.resolveReadinessSnapshot(runner, s, LocalDate.now(clock.withZone(ActivityLocalDates.zoneOf(runner))));
        ReadinessService.ReadinessResult readiness = resolveReadiness(snapshot, s);
        ReadinessService.MetricReadings readings = snapshot == null || snapshot.readings() == null
                ? ReadinessService.MetricReadings.none() : snapshot.readings();
        CoachStaminaDto stamina = readings.bodyBatteryAtWake() == null ? null
                : new CoachStaminaDto(readings.bodyBatteryAtWake(), readings.bodyBatteryAtWake(), null, null, "steady");
        ReadinessService.MetricAvailability availability = snapshot == null || snapshot.availability() == null
                ? ReadinessService.MetricAvailability.none()
                : snapshot.availability();
        boolean readinessDataSupported = availability.any();
        boolean sleepDataSupported = availability.sleep();
        String sleepDataSource = sleepDataSupported && snapshot != null && snapshot.sources() != null
                ? snapshot.sources().sleep()
                : null;
        return new CoachStateDto(
                s.getVolumeKm7d(), s.getVolumeKm28d(), s.getMinutesLowZ1Z2Last7d(),
                s.getMinutesGreyZ3Last7d(), s.getMinutesHighZ4Z5Last7d(), s.getMinutesUnknownHrLast7d(),
                s.getHighIntensityRatioLast7d(), s.isHighMileageGrinder(),
                s.getBaselineRestingHr(), readings.restingHeartRate(), readings.sleepScore(), readings.hrvMs(), readings.stressScore(),
                readings.hrvStatus(), readings.bodyBatteryAtWake(),
                readinessDataSupported ? readiness.score() : null, readinessDataSupported ? readiness.verdict() : null,
                availability.sleep() ? readiness.sleepScore() : null, availability.hrv() ? readiness.hrvScore() : null,
                availability.restingHeartRate() ? readiness.rhrScore() : null, availability.stress() ? readiness.stressScore() : null,
                availability.trainingLoad() ? readiness.loadScore() : null, readiness.confidence(),
                readinessDataSupported ? readiness.score() : null, readinessDataSupported,
                sleepDataSupported, sleepDataSource,
                runner.getMaxHeartRateBpm(), runner.getRestingHeartRateBpm(), stamina,
                coachTrainingBlockRepository.findByRunnerAndActiveTrue(runner).map(b -> new CoachTrainingBlockDto(
                        b.getRaceDistanceKm(), b.getTargetRaceDate(), b.getWeekIndex(), b.getCurrentLongRunKm(), b.getName()
                )).orElse(null)
        );
    }

    private ReadinessService.ReadinessResult resolveReadiness(Runner runner, CoachRunnerState state, LocalDate date) {
        ReadinessService.MultiSourceReadinessSnapshot snapshot = readinessService.resolveReadinessSnapshot(runner, state, date);
        return resolveReadiness(snapshot, state);
    }

    private ReadinessService.ReadinessResult resolveReadiness(
            ReadinessService.MultiSourceReadinessSnapshot snapshot,
            CoachRunnerState state
    ) {
        if (snapshot != null && snapshot.readiness() != null) {
            return snapshot.readiness();
        }
        if (state != null) {
            ReadinessService.ReadinessResult computed = readinessService.compute(state);
            if (computed != null) return computed;
        }
        return new ReadinessService.ReadinessResult(75, "EASY", 75, 75, 75, 75, 75, 0);
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
            Integer readinessLoad, Integer readinessConfidence,
            Integer currentReadinessScore, boolean readinessDataSupported,
            boolean sleepDataSupported, String sleepDataSource,
            Integer profileMaxHeartRateBpm, Integer profileRestingHeartRateBpm, CoachStaminaDto stamina,
            CoachTrainingBlockDto activeBlock
    ) {
        @com.fasterxml.jackson.annotation.JsonProperty("readinessAvailability")
        public ReadinessService.MetricAvailability readinessAvailability() {
            return new ReadinessService.MetricAvailability(readinessSleep != null, readinessHrv != null,
                    readinessRhr != null, readinessStress != null, readinessLoad != null);
        }
    }

    public record CoachScheduledWorkoutDto(
            LocalDate scheduledDate, String workoutType, Double plannedDistanceKm,
            Integer plannedDurationMinutes, boolean stridesSuggested, String notes,
            String mutatedFrom, boolean readinessAdjusted,
            String phase, String intent, String reasonCode,
            Integer targetPaceMinSecondsPerKm, Integer targetPaceMaxSecondsPerKm, Double originalDistanceKm
    ) {
        public CoachScheduledWorkoutDto(LocalDate scheduledDate, String workoutType, Double plannedDistanceKm,
                Integer plannedDurationMinutes, boolean stridesSuggested, String notes, String mutatedFrom, boolean readinessAdjusted,
                String phase, String intent, String reasonCode, Integer targetPaceMinSecondsPerKm, Integer targetPaceMaxSecondsPerKm) {
            this(scheduledDate, workoutType, plannedDistanceKm, plannedDurationMinutes, stridesSuggested, notes, mutatedFrom,
                    readinessAdjusted, phase, intent, reasonCode, targetPaceMinSecondsPerKm, targetPaceMaxSecondsPerKm, null);
        }
        public CoachScheduledWorkoutDto(
                LocalDate scheduledDate, String workoutType, Double plannedDistanceKm,
                Integer plannedDurationMinutes, boolean stridesSuggested, String notes,
                String mutatedFrom, boolean readinessAdjusted
        ) {
            this(scheduledDate, workoutType, plannedDistanceKm, plannedDurationMinutes,
                    stridesSuggested, notes, mutatedFrom, readinessAdjusted,
                    null, null, null, null, null);
        }
    }

    public record CoachPlanDto(
            String phase, double targetWeeklyKm, int sessionsPerWeek,
            List<String> preferredRunDays, int confidence, List<String> reasonCodes, String timeZone,
            PersonalizedRunningPlanner.HistoryEvidence historyEvidence, List<WeeklyMileageBudget.Week> weeklyBudgets,
            ReadinessService.RecoveryEvidence recoveryEvidence
    ) {
        public CoachPlanDto(String phase, double targetWeeklyKm, int sessionsPerWeek,
                List<String> preferredRunDays, int confidence, List<String> reasonCodes, String timeZone) {
            this(phase, targetWeeklyKm, sessionsPerWeek, preferredRunDays, confidence, reasonCodes, timeZone, null, List.of(), null);
        }
        public CoachPlanDto(String phase, double targetWeeklyKm, int sessionsPerWeek,
                List<String> preferredRunDays, int confidence, List<String> reasonCodes) {
            this(phase, targetWeeklyKm, sessionsPerWeek, preferredRunDays, confidence, reasonCodes, null);
        }
    }

    public record CoachTrainingBlockDto(double raceDistanceKm, LocalDate targetRaceDate, int weekIndex, double currentLongRunKm, String name) {}

    public record CoachRecommendedShoeDto(
            Long id, String brand, String model, String nickname, String photoUrl,
            Double currentDistanceKm, Double maxDistanceKm, String type, String surfaceType,
            LocalDateTime lastWornAt, Integer daysSinceLastWear, String recommendationReason
    ) {}

    public record CoachTodayDto(
            CoachScheduledWorkoutDto today, CoachStateDto state,
            CoachRouteRecommendationDto routeRecommendation, CoachRecommendedShoeDto recommendedShoe,
            String runnerState, String coachMessage, CoachPlanDto plan, List<CoachScheduledWorkoutDto> schedule,
            List<CoachScheduledWorkoutDto> weekSchedule
    ) {
        public CoachTodayDto(CoachScheduledWorkoutDto today, CoachStateDto state,
                CoachRouteRecommendationDto routeRecommendation, CoachRecommendedShoeDto recommendedShoe,
                String runnerState, String coachMessage, CoachPlanDto plan, List<CoachScheduledWorkoutDto> schedule) {
            this(today, state, routeRecommendation, recommendedShoe, runnerState, coachMessage, plan, schedule, List.of());
        }
        public CoachTodayDto(CoachScheduledWorkoutDto today, CoachStateDto state,
                CoachRouteRecommendationDto routeRecommendation, CoachRecommendedShoeDto recommendedShoe,
                String runnerState, String coachMessage, CoachPlanDto plan) {
            this(today, state, routeRecommendation, recommendedShoe, runnerState, coachMessage, plan, List.of());
        }
        public CoachTodayDto(
                CoachScheduledWorkoutDto today, CoachStateDto state,
                CoachRouteRecommendationDto routeRecommendation, CoachRecommendedShoeDto recommendedShoe,
                String runnerState, String coachMessage
        ) {
            this(today, state, routeRecommendation, recommendedShoe, runnerState, coachMessage, null, List.of());
        }
    }

    public record CoachFeedbackAlertDto(Long id, String alertType, String message, LocalDateTime createdAt) {}
}
