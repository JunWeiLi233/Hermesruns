package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class MuscleTrainingPlannerService {

    private final MuscleTrainingProfileService profileService;
    private final MuscleTrainingCheckInService checkInService;
    private final MuscleTrainingMetricsService metricsService;
    private final MuscleTrainingSessionService sessionService;
    private final ActivityRepository activityRepository;
    private final SorenessLogRepository sorenessLogRepository;
    private final InjuryRiskService injuryRiskService;
    private final RunnerStrengthSignalService strengthSignalService;
    private final PersonalizedStrengthPlanEngine strengthPlanEngine;

    public MuscleTrainingPlannerService(
            MuscleTrainingProfileService profileService,
            MuscleTrainingCheckInService checkInService,
            MuscleTrainingMetricsService metricsService,
            MuscleTrainingSessionService sessionService,
            ActivityRepository activityRepository,
            SorenessLogRepository sorenessLogRepository,
            InjuryRiskService injuryRiskService,
            RunnerStrengthSignalService strengthSignalService,
            PersonalizedStrengthPlanEngine strengthPlanEngine
    ) {
        this.profileService = profileService;
        this.checkInService = checkInService;
        this.metricsService = metricsService;
        this.sessionService = sessionService;
        this.activityRepository = activityRepository;
        this.sorenessLogRepository = sorenessLogRepository;
        this.injuryRiskService = injuryRiskService;
        this.strengthSignalService = strengthSignalService;
        this.strengthPlanEngine = strengthPlanEngine;
    }

    @Transactional
    public MuscleProfileDto getProfile(Runner runner) {
        return profileService.getProfile(runner);
    }

    @Transactional
    public MuscleProfileDto updateProfile(Runner runner, MuscleProfileUpdate update) {
        return profileService.updateProfile(runner, update);
    }

    @Transactional(readOnly = true)
    public TodayCheckInDto getTodayCheckIn(Runner runner) {
        return checkInService.getTodayCheckIn(runner);
    }

    @Transactional
    public TodayCheckInDto updateTodayCheckIn(Runner runner, TodayCheckInUpdate update) {
        return checkInService.updateTodayCheckIn(runner, update);
    }

    @Transactional
    public void clearTodayCheckIn(Runner runner) {
        checkInService.clearTodayCheckIn(runner);
    }

    @Transactional
    public MusclePlanDto getPlan(
            Runner runner,
            AutomatedCoachService.CoachStateDto coachState,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule
    ) {
        MuscleTrainingPreference preference = profileService.getOrCreatePreference(runner);
        TodayCheckInDto todayCheckIn = checkInService.getTodayCheckIn(runner);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> effectiveSchedule = applyTodayCheckIn(schedule, todayCheckIn);
        List<Activity> recentRuns = activityRepository.findRunsBetween(
                runner, ActivityType.RUN,
                LocalDate.now().minusDays(35).atStartOfDay(),
                LocalDate.now().atTime(23, 59)
        );

        MuscleTrainingMetricsService.PlanMetrics metrics = metricsService.buildMetrics(recentRuns, coachState, preference, effectiveSchedule);
        LocalDate today = LocalDate.now();
        String sorenessLevel = sorenessLogRepository.findByRunnerAndDate(runner, today)
                .map(SorenessLog::getLevel)
                .orElse(null);
        String injuryRisk = null;
        try {
            injuryRisk = injuryRiskService.getRiskAssessment(runner).risk();
        } catch (Exception ignored) {
            // Injury-risk assessment is best-effort; never block the plan on it.
        }
        LocalDate targetRaceDate = coachState != null && coachState.activeBlock() != null
                ? coachState.activeBlock().targetRaceDate()
                : null;
        boolean recoveryDataPresent = coachState != null && coachState.readinessDataSupported();
        RunnerStrengthSignals strengthSignals = strengthSignalService.normalize(
                today,
                preference,
                metrics,
                effectiveSchedule,
                todayCheckIn,
                sorenessLevel,
                injuryRisk,
                targetRaceDate,
                recoveryDataPresent
        );
        PersonalizedStrengthPlan personalizedStrengthPlan = strengthPlanEngine.plan(strengthSignals);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> visibleSchedule = effectiveSchedule.stream()
                .limit(7)
                .toList();
        List<MuscleDayPlanDto> days = assignSessions(
                visibleSchedule,
                metrics,
                preference,
                todayCheckIn,
                personalizedStrengthPlan
        );
        List<SessionDefinitionDto> assignedSessions = assignedSessionDefinitions(days, preference, metrics);

        String todaySessionType = days.stream()
                .filter(d -> today.equals(d.date()))
                .map(d -> d.run() != null ? d.run().workoutType() : null)
                .findFirst()
                .orElse(null);
        MuscleTrainingMetricsService.RecommendedArea recommendedArea =
                metricsService.deriveRecommendedMuscleArea(metrics, sorenessLevel, injuryRisk, todaySessionType);

        return new MusclePlanDto(
                metricsService.buildWeekContext(metrics),
                days,
                assignedSessions,
                buildRationaleCodes(preference, metrics),
                todayCheckIn,
                resolvePlanSource(todayCheckIn),
                recommendedArea.focus(),
                recommendedArea.reasonCode(),
                toStrengthCoachDecision(personalizedStrengthPlan)
        );
    }

    private List<AutomatedCoachService.CoachScheduledWorkoutDto> applyTodayCheckIn(
            List<AutomatedCoachService.CoachScheduledWorkoutDto> coachSchedule,
            TodayCheckInDto todayCheckIn
    ) {
        if (todayCheckIn == null) {
            return coachSchedule;
        }

        List<AutomatedCoachService.CoachScheduledWorkoutDto> adjusted = new ArrayList<>(coachSchedule.size());
        LocalDate today = LocalDate.now();
        for (AutomatedCoachService.CoachScheduledWorkoutDto day : coachSchedule) {
            if (!today.equals(day.scheduledDate())) {
                adjusted.add(day);
                continue;
            }
            adjusted.add(new AutomatedCoachService.CoachScheduledWorkoutDto(
                    day.scheduledDate(),
                    todayCheckIn.runType(),
                    todayCheckIn.distanceKm(),
                    todayCheckIn.durationMinutes(),
                    false,
                    null,
                    day.workoutType(),
                    false
            ));
        }
        return adjusted;
    }

    private List<MuscleDayPlanDto> assignSessions(
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            MuscleTrainingMetricsService.PlanMetrics metrics,
            MuscleTrainingPreference preference,
            TodayCheckInDto todayCheckIn,
            PersonalizedStrengthPlan personalizedStrengthPlan
    ) {
        List<MuscleDayPlanDto> days = new ArrayList<>();
        Map<LocalDate, PersonalizedStrengthPlan.PlannedDay> strengthByDate = personalizedStrengthPlan.days().stream()
                .collect(java.util.stream.Collectors.toMap(PersonalizedStrengthPlan.PlannedDay::date, day -> day));

        for (int index = 0; index < schedule.size(); index++) {
            AutomatedCoachService.CoachScheduledWorkoutDto w = schedule.get(index);
            String dayLabel = w.scheduledDate().getDayOfWeek().name();
            RunPlanDto run = new RunPlanDto(
                    w.workoutType(),
                    w.plannedDistanceKm(),
                    w.plannedDurationMinutes(),
                    isKeyRun(w.workoutType()),
                    isLongRun(w.workoutType()),
                    w.readinessAdjusted(),
                    w.notes(),
                    resolveDayPlanSource(w.scheduledDate(), todayCheckIn)
            );

            StrengthAssignmentDto strength = null;
            String noStrengthReason = placementBlockReason(index, schedule, metrics);
            PersonalizedStrengthPlan.PlannedDay strengthDay = strengthByDate.get(w.scheduledDate());

            if (noStrengthReason == null && strengthDay != null && strengthDay.strength() != null) {
                strength = buildPersonalizedAssignment(strengthDay.strength(), preference, metrics);
            } else if (noStrengthReason == null) {
                noStrengthReason = mapNoStrengthReason(strengthDay != null ? strengthDay.noStrengthReasonCode() : null);
            }

            days.add(new MuscleDayPlanDto(w.scheduledDate(), dayLabel, run, strength, noStrengthReason));
        }
        return days;
    }

    private String placementBlockReason(
            int index,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        if (metrics.recommendedSessionsPerWeek() <= 0) {
            return "SKIP_WEEK";
        }
        String workoutType = schedule.get(index).workoutType();
        if (isLongRun(workoutType)) {
            return "SKIP_LONG_RUN_DAY";
        }
        if (isKeyRun(workoutType)) {
            return "SKIP_KEY_RUN_DAY";
        }
        if (index > 0 && isLongRun(schedule.get(index - 1).workoutType())) {
            return "SKIP_LONG_RUN_DAY";
        }
        if (index + 1 < schedule.size() && isLongRun(schedule.get(index + 1).workoutType())) {
            return "SKIP_LONG_RUN_TOMORROW";
        }
        if (index + 1 < schedule.size() && isKeyRun(schedule.get(index + 1).workoutType())) {
            return "SKIP_KEY_RUN_TOMORROW";
        }
        return null;
    }

    private StrengthAssignmentDto buildPersonalizedAssignment(
            PersonalizedStrengthPlan.PlannedSession plannedSession,
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        SessionDefinitionDto session = sessionService.buildSessionDefinition(plannedSession.sessionType(), preference, metrics);
        return new StrengthAssignmentDto(
                session.sessionType(),
                session.title(),
                session.emphasis(),
                session.durationMinutes(),
                session.targetRpe(),
                session.optional(),
                isQuietCompatible(session.sessionType()),
                plannedSession.reasonCodes().isEmpty() ? "PERSONALIZED_ENGINE" : plannedSession.reasonCodes().get(0),
                null
        );
    }

    private String mapNoStrengthReason(String reasonCode) {
        if (reasonCode == null || reasonCode.isBlank()) {
            return "WEEKLY_CAP_REACHED";
        }
        return switch (reasonCode) {
            case "KEY_RUN_DAY" -> "SKIP_KEY_RUN_DAY";
            case "LONG_RUN_DAY" -> "SKIP_LONG_RUN_DAY";
            case "KEY_RUN_BUFFER" -> "SKIP_KEY_RUN_TOMORROW";
            case "LONG_RUN_BUFFER" -> "SKIP_LONG_RUN_TOMORROW";
            case "SAFETY_NO_SESSION", "RACE_DAY_NO_PRIMARY_STRENGTH" -> "SKIP_WEEK";
            default -> "WEEKLY_CAP_REACHED";
        };
    }

    private StrengthCoachDecisionDto toStrengthCoachDecision(PersonalizedStrengthPlan plan) {
        PersonalizedStrengthPlan.PlannedDay appliedDay = plan.days().stream()
                .filter(day -> day.strength() != null)
                .findFirst()
                .orElse(null);
        PersonalizedStrengthPlan.PlannedSession session = appliedDay != null ? appliedDay.strength() : null;
        PersonalizedStrengthPlan.SafetyAdjustment adjustment = plan.safetyAdjustment();

        return new StrengthCoachDecisionDto(
                plan.algorithmVersion(),
                plan.phase().name(),
                plan.weekNumber(),
                plan.confidence().name(),
                plan.missingSignals(),
                appliedDay != null ? appliedDay.date() : null,
                enumName(session != null ? session.requestedFocus() : adjustment != null ? adjustment.requestedFocus() : null),
                enumName(session != null ? session.requestedDose() : adjustment != null ? adjustment.requestedDose() : null),
                enumName(session != null ? session.appliedFocus() : adjustment != null ? adjustment.appliedFocus() : null),
                enumName(session != null ? session.appliedDose() : adjustment != null ? adjustment.appliedDose() : null),
                enumName(session != null ? session.safetyAction() : adjustment != null ? adjustment.action() : RunnerStrengthSignals.SafetyAction.NONE),
                session != null ? session.reasonCodes() : adjustment != null ? adjustment.reasonCodes() : List.of()
        );
    }

    private String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }

    private List<SessionDefinitionDto> assignedSessionDefinitions(
            List<MuscleDayPlanDto> days,
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        LinkedHashSet<String> sessionTypes = new LinkedHashSet<>();
        for (MuscleDayPlanDto day : days) {
            if (day.strength() != null) {
                sessionTypes.add(day.strength().sessionType());
            }
        }
        List<SessionDefinitionDto> sessions = new ArrayList<>();
        for (String sessionType : sessionTypes) {
            sessions.add(sessionService.buildSessionDefinition(sessionType, preference, metrics));
        }
        return sessions;
    }

    private List<String> buildRationaleCodes(
            MuscleTrainingPreference preference,
            MuscleTrainingMetricsService.PlanMetrics metrics
    ) {
        List<String> rationale = new ArrayList<>();
        rationale.add("R_FOCUS_" + metrics.currentFocus());
        rationale.add("R_LOAD_" + metrics.loadStatus());
        if (metrics.conservativeMode()) {
            rationale.add("R_CONSERVATIVE_DATA");
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            rationale.add("R_QUIET_FILTER");
        }
        if (metrics.raceWeek()) {
            rationale.add("R_RACE_WEEK");
        }
        if (!"OPEN".equals(metrics.recoveryGate())) {
            rationale.add("R_RECOVERY_GATE");
        }
        if (metrics.recommendedSessionsPerWeek() == 0) {
            rationale.add("R_SKIP_WEEK");
        }
        return rationale;
    }

    private String resolvePlanSource(TodayCheckInDto todayCheckIn) {
        if (todayCheckIn == null) {
            return "COACH_SCHEDULE";
        }
        return switch (todayCheckIn.entryState()) {
            case "ACTUAL" -> "USER_ACTUAL";
            case "PLANNED" -> "USER_PLANNED";
            default -> "COACH_SCHEDULE";
        };
    }

    private String resolveDayPlanSource(LocalDate date, TodayCheckInDto todayCheckIn) {
        if (date != null && date.equals(LocalDate.now()) && todayCheckIn != null) {
            return resolvePlanSource(todayCheckIn);
        }
        return "COACH_SCHEDULE";
    }

    private boolean isQuietCompatible(String sessionType) {
        return !"OPTIONAL_ELASTICITY".equals(sessionType);
    }

    private boolean isKeyRun(String workoutType) {
        return Objects.equals(workoutType, MuscleTrainingCheckIn.RunType.QUALITY.name())
                || Objects.equals(workoutType, CoachWorkoutType.THRESHOLD.name())
                || Objects.equals(workoutType, CoachWorkoutType.TEMPO.name())
                || Objects.equals(workoutType, CoachWorkoutType.INTERVALS.name());
    }

    private boolean isLongRun(String workoutType) {
        return Objects.equals(workoutType, CoachWorkoutType.LONG_RUN.name());
    }
}
