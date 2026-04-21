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

    public MuscleTrainingPlannerService(
            MuscleTrainingProfileService profileService,
            MuscleTrainingCheckInService checkInService,
            MuscleTrainingMetricsService metricsService,
            MuscleTrainingSessionService sessionService,
            ActivityRepository activityRepository
    ) {
        this.profileService = profileService;
        this.checkInService = checkInService;
        this.metricsService = metricsService;
        this.sessionService = sessionService;
        this.activityRepository = activityRepository;
    }

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public MusclePlanDto getPlan(
            Runner runner,
            AutomatedCoachService.CoachStateDto coachState,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule
    ) {
        MuscleTrainingPreference preference = profileService.getOrCreatePreference(runner);
        List<Activity> recentRuns = activityRepository.findRunsBetween(
                runner, ActivityType.RUN,
                LocalDate.now().minusDays(35).atStartOfDay(),
                LocalDate.now().atTime(23, 59)
        );

        MuscleTrainingMetricsService.PlanMetrics metrics = metricsService.buildMetrics(recentRuns, coachState, preference);
        List<MuscleDayPlanDto> days = assignSessions(schedule, metrics, preference);
        List<SessionDefinitionDto> allSessions = sessionService.buildAllSessionDefinitions(preference, metrics);
        
        List<String> rationale = new ArrayList<>();
        rationale.add("Focus: " + metrics.currentFocus());
        rationale.add("Load status: " + metrics.loadStatus());
        if (!"OPEN".equals(metrics.recoveryGate())) {
            rationale.add("Recovery gate active: " + metrics.recoveryGate());
        }

        return new MusclePlanDto(
                metricsService.buildWeekContext(metrics),
                days,
                allSessions,
                rationale,
                checkInService.getTodayCheckIn(runner),
                "ALGORITHMIC_V2"
        );
    }

    private List<MuscleDayPlanDto> assignSessions(
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            MuscleTrainingMetricsService.PlanMetrics metrics,
            MuscleTrainingPreference preference
    ) {
        List<MuscleDayPlanDto> days = new ArrayList<>();
        int sessionsAssigned = 0;
        int maxSessions = metrics.recommendedSessionsPerWeek();

        for (AutomatedCoachService.CoachScheduledWorkoutDto w : schedule) {
            String dayLabel = w.scheduledDate().getDayOfWeek().name();
            RunPlanDto run = new RunPlanDto(
                    w.workoutType(),
                    w.plannedDistanceKm(),
                    w.plannedDurationMinutes(),
                    false, 
                    "LONG_RUN".equals(w.workoutType()),
                    w.readinessAdjusted(),
                    w.notes(),
                    "COACH_SYNC"
            );

            StrengthAssignmentDto strength = null;
            String noStrengthReason = null;

            boolean canAssign = sessionsAssigned < maxSessions;
            if (canAssign) {
                if ("REST".equals(w.workoutType()) || "EASY".equals(w.workoutType())) {
                    strength = buildDefaultAssignment(sessionsAssigned);
                    sessionsAssigned++;
                } else {
                    noStrengthReason = "KEY_RUN_PRIORITY";
                }
            } else {
                noStrengthReason = "WEEKLY_CAP_REACHED";
            }

            days.add(new MuscleDayPlanDto(w.scheduledDate(), dayLabel, run, strength, noStrengthReason));
        }
        return days;
    }

    private StrengthAssignmentDto buildDefaultAssignment(int index) {
        if (index == 0) {
            return new StrengthAssignmentDto("FOUNDATION_STRENGTH", "Foundation strength", "Single-leg strength, posterior chain", 35, 7, false, true, "REST_DAY_OPTIMAL", null);
        }
        return new StrengthAssignmentDto("RESILIENCE_CAPACITY", "Resilience capacity", "Tissue capacity, trunk control", 25, 6, false, true, "EASY_DAY_PAIRING", null);
    }
}
