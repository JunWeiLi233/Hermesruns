package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class MuscleTrainingPlannerService {

    private final MuscleTrainingPreferenceRepository preferenceRepository;
    private final MuscleTrainingCheckInRepository checkInRepository;
    private final ActivityRepository activityRepository;
    private final AutomatedCoachService automatedCoachService;

    public MuscleTrainingPlannerService(
            MuscleTrainingPreferenceRepository preferenceRepository,
            MuscleTrainingCheckInRepository checkInRepository,
            ActivityRepository activityRepository,
            AutomatedCoachService automatedCoachService
    ) {
        this.preferenceRepository = preferenceRepository;
        this.checkInRepository = checkInRepository;
        this.activityRepository = activityRepository;
        this.automatedCoachService = automatedCoachService;
    }

    @Transactional
    public MuscleProfileDto getProfile(Runner runner) {
        return toProfileDto(getOrCreatePreference(runner));
    }

    @Transactional
    public MuscleProfileDto updateProfile(Runner runner, MuscleProfileUpdate update) {
        MuscleTrainingPreference preference = getOrCreatePreference(runner);

        if (update.experienceLevel() != null) {
            preference.setExperienceLevel(parseEnum(
                    MuscleTrainingPreference.ExperienceLevel.class,
                    update.experienceLevel(),
                    "experienceLevel"
            ));
        }
        if (update.equipmentLevel() != null) {
            preference.setEquipmentLevel(parseEnum(
                    MuscleTrainingPreference.EquipmentLevel.class,
                    update.equipmentLevel(),
                    "equipmentLevel"
            ));
        }
        if (update.noisePreference() != null) {
            preference.setNoisePreference(parseEnum(
                    MuscleTrainingPreference.NoisePreference.class,
                    update.noisePreference(),
                    "noisePreference"
            ));
        }
        if (update.sessionMinutes() != null) {
            preference.setSessionMinutes(Math.max(15, Math.min(75, update.sessionMinutes())));
        }
        if (update.preferredStrengthDays() != null) {
            LinkedHashSet<DayOfWeek> days = new LinkedHashSet<>();
            for (String raw : update.preferredStrengthDays()) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                days.add(parseEnum(DayOfWeek.class, raw, "preferredStrengthDays"));
            }
            preference.setPreferredStrengthDays(days.isEmpty() ? defaultPreferredDays() : days);
        }

        preference.touch();
        return toProfileDto(preferenceRepository.save(preference));
    }

    @Transactional(readOnly = true)
    public TodayCheckInDto getTodayCheckIn(Runner runner) {
        return findTodayCheckIn(runner)
                .map(this::toTodayCheckInDto)
                .orElse(null);
    }

    @Transactional
    public TodayCheckInDto updateTodayCheckIn(Runner runner, TodayCheckInUpdate update) {
        if (update == null) {
            throw new IllegalArgumentException("runType is required.");
        }

        MuscleTrainingCheckIn checkIn = findTodayCheckIn(runner).orElseGet(() -> {
            MuscleTrainingCheckIn created = new MuscleTrainingCheckIn();
            created.setRunner(runner);
            created.setTrainingDate(LocalDate.now());
            return created;
        });

        if (update.runType() == null || update.runType().isBlank()) {
            throw new IllegalArgumentException("runType is required.");
        }
        if (update.entryState() == null || update.entryState().isBlank()) {
            throw new IllegalArgumentException("entryState is required.");
        }
        if (update.distanceKm() != null && update.distanceKm() < 0) {
            throw new IllegalArgumentException("distanceKm must be zero or greater.");
        }
        if (update.durationMinutes() != null && update.durationMinutes() < 0) {
            throw new IllegalArgumentException("durationMinutes must be zero or greater.");
        }

        checkIn.setRunType(parseEnum(MuscleTrainingCheckIn.RunType.class, update.runType(), "runType"));
        checkIn.setEntryState(parseEnum(MuscleTrainingCheckIn.EntryState.class, update.entryState(), "entryState"));
        checkIn.setDistanceKm(normalizeOptionalDistance(update.distanceKm()));
        checkIn.setDurationMinutes(normalizeOptionalDuration(update.durationMinutes()));
        return toTodayCheckInDto(checkInRepository.save(checkIn));
    }

    @Transactional
    public void clearTodayCheckIn(Runner runner) {
        checkInRepository.deleteByRunnerAndTrainingDate(runner, LocalDate.now());
    }

    private MuscleTrainingPreference getOrCreatePreference(Runner runner) {
        return preferenceRepository.findByRunner(runner).orElseGet(() -> {
            MuscleTrainingPreference preference = new MuscleTrainingPreference();
            preference.setRunner(runner);
            preference.setPreferredStrengthDays(defaultPreferredDays());
            return preferenceRepository.save(preference);
        });
    }

    private LinkedHashSet<DayOfWeek> defaultPreferredDays() {
        return new LinkedHashSet<>(List.of(DayOfWeek.MONDAY, DayOfWeek.THURSDAY));
    }

    private <E extends Enum<E>> E parseEnum(Class<E> type, String rawValue, String fieldName) {
        try {
            return Enum.valueOf(type, rawValue.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ignored) {
            throw new IllegalArgumentException(fieldName + " has an invalid value.");
        }
    }

    private MuscleProfileDto toProfileDto(MuscleTrainingPreference preference) {
        List<String> preferredDays = preference.getPreferredStrengthDays().stream()
                .sorted(Comparator.comparingInt(DayOfWeek::getValue))
                .map(DayOfWeek::name)
                .toList();
        return new MuscleProfileDto(
                preference.getExperienceLevel().name(),
                preference.getEquipmentLevel().name(),
                preference.getSessionMinutes(),
                preference.getNoisePreference().name(),
                preferredDays
        );
    }

    private java.util.Optional<MuscleTrainingCheckIn> findTodayCheckIn(Runner runner) {
        return checkInRepository.findByRunnerAndTrainingDate(runner, LocalDate.now());
    }

    private TodayCheckInDto toTodayCheckInDto(MuscleTrainingCheckIn checkIn) {
        return new TodayCheckInDto(
                checkIn.getTrainingDate(),
                checkIn.getRunType().name(),
                checkIn.getEntryState().name(),
                checkIn.getDistanceKm(),
                checkIn.getDurationMinutes(),
                checkIn.getUpdatedAt()
        );
    }

    private Double normalizeOptionalDistance(Double value) {
        if (value == null || value <= 0) {
            return null;
        }
        return Math.round(value * 10.0) / 10.0;
    }

    private Integer normalizeOptionalDuration(Integer value) {
        if (value == null || value <= 0) {
            return null;
        }
        return value;
    }

    @Transactional
    public MusclePlanDto getPlan(Runner runner) {
        MuscleTrainingPreference preference = getOrCreatePreference(runner);
        TodayCheckInDto todayCheckIn = getTodayCheckIn(runner);
        AutomatedCoachService.CoachStateDto coachState = automatedCoachService.getCoachState(runner);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> coachSchedule = automatedCoachService.getSchedule(runner, 7);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> effectiveSchedule = applyTodayCheckIn(coachSchedule, todayCheckIn);
        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);
        String planSource = resolvePlanSource(todayCheckIn);

        PlanMetrics metrics = buildMetrics(runs, coachState, effectiveSchedule, preference);
        List<AssignedSession> assignments = assignSessions(preference, metrics, effectiveSchedule);
        Map<String, SessionDefinitionDto> sessionDefs = new LinkedHashMap<>();
        for (AssignedSession assignment : assignments) {
            sessionDefs.computeIfAbsent(
                    assignment.sessionType(),
                    ignored -> buildSessionDefinition(assignment.sessionType(), preference, metrics)
            );
        }

        Map<LocalDate, AssignedSession> assignmentByDate = new LinkedHashMap<>();
        for (AssignedSession assignment : assignments) {
            assignmentByDate.put(assignment.date(), assignment);
        }

        List<MuscleDayPlanDto> days = new ArrayList<>();
        for (AutomatedCoachService.CoachScheduledWorkoutDto workout : effectiveSchedule) {
            AssignedSession assignment = assignmentByDate.get(workout.scheduledDate());
            days.add(new MuscleDayPlanDto(
                    workout.scheduledDate(),
                    workout.scheduledDate().getDayOfWeek().name(),
                    new RunPlanDto(
                            workout.workoutType(),
                            workout.plannedDistanceKm(),
                            workout.plannedDurationMinutes(),
                            isKeyRun(workout.workoutType()),
                            isLongRun(workout.workoutType()),
                            workout.readinessAdjusted(),
                            workout.notes(),
                            resolveDayPlanSource(workout.scheduledDate(), todayCheckIn)
                    ),
                    assignment != null ? assignment.strength() : null,
                    assignment == null ? explainNoStrengthReason(workout.scheduledDate(), effectiveSchedule, metrics, assignments) : null
            ));
        }

        return new MusclePlanDto(
                toProfileDto(preference),
                new MuscleWeekContextDto(
                        round1(metrics.volumeKm7d()),
                        round1(metrics.volumeKm28d()),
                        metrics.acwr() != null ? round2(metrics.acwr()) : null,
                        metrics.highIntensityRatioLast7d(),
                        metrics.loadStatus(),
                        metrics.recoveryGate(),
                        metrics.recommendedSessionsPerWeek(),
                        metrics.currentFocus(),
                        metrics.conservativeMode(),
                        metrics.raceWeek(),
                        metrics.nextKeyRunDate(),
                        metrics.nextKeyRunType(),
                        metrics.nextLongRunDate(),
                        metrics.nextLongRunKm(),
                        metrics.recentHardRunCount7d()
                ),
                days,
                new ArrayList<>(sessionDefs.values()),
                buildRationaleCodes(preference, metrics, assignments),
                todayCheckIn,
                planSource
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
                    normalizeWorkoutType(todayCheckIn.runType()),
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

    private String normalizeWorkoutType(String runType) {
        if (Objects.equals(runType, MuscleTrainingCheckIn.RunType.QUALITY.name())) {
            return MuscleTrainingCheckIn.RunType.QUALITY.name();
        }
        return runType;
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

    private PlanMetrics buildMetrics(
            List<Activity> runs,
            AutomatedCoachService.CoachStateDto coachState,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> coachSchedule,
            MuscleTrainingPreference preference
    ) {
        double volume7d = coachState.volumeKm7d();
        double volume28d = coachState.volumeKm28d();
        Double acwr = computeAcwr(runs);
        Double hiRatio = coachState.highIntensityRatioLast7d();
        boolean conservativeMode = runsWithinDays(runs, 28).size() < 3 || volume7d < 8;

        String recoveryGate = deriveRecoveryGate(coachState);
        boolean raceWeek = coachState.activeBlock() != null
                && coachState.activeBlock().targetRaceDate() != null
                && !coachState.activeBlock().targetRaceDate().isBefore(LocalDate.now())
                && java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), coachState.activeBlock().targetRaceDate()) <= 7;

        String loadStatus = deriveLoadStatus(volume28d, acwr, raceWeek, conservativeMode);
        int recommendedSessions = deriveRecommendedSessions(
                volume7d,
                volume28d,
                acwr,
                recoveryGate,
                raceWeek,
                conservativeMode,
                preference
        );

        AutomatedCoachService.CoachScheduledWorkoutDto nextKeyRun = coachSchedule.stream()
                .filter(day -> isKeyRun(day.workoutType()))
                .findFirst()
                .orElse(null);
        AutomatedCoachService.CoachScheduledWorkoutDto nextLongRun = coachSchedule.stream()
                .filter(day -> isLongRun(day.workoutType()))
                .findFirst()
                .orElse(null);

        return new PlanMetrics(
                volume7d,
                volume28d,
                acwr,
                hiRatio,
                recoveryGate,
                loadStatus,
                conservativeMode,
                raceWeek,
                recommendedSessions,
                deriveCurrentFocus(preference, loadStatus, recoveryGate),
                nextKeyRun != null ? nextKeyRun.scheduledDate() : null,
                nextKeyRun != null ? nextKeyRun.workoutType() : null,
                nextLongRun != null ? nextLongRun.scheduledDate() : null,
                nextLongRun != null ? nextLongRun.plannedDistanceKm() : null,
                countRecentHardRuns(runs, coachState)
        );
    }

    private int deriveRecommendedSessions(
            double volume7d,
            double volume28d,
            Double acwr,
            String recoveryGate,
            boolean raceWeek,
            boolean conservativeMode,
            MuscleTrainingPreference preference
    ) {
        if ("PROTECT".equals(recoveryGate) && raceWeek) {
            return 0;
        }
        if (raceWeek || "PROTECT".equals(recoveryGate) || (acwr != null && acwr > 1.35)) {
            return 1;
        }
        if (conservativeMode || volume28d < 60 || volume7d < 15) {
            return 1;
        }

        int sessions = volume28d < 180 ? 2 : 3;
        if ("CAUTION".equals(recoveryGate) || (acwr != null && acwr > 1.18)) {
            sessions = Math.min(sessions, 2);
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            sessions = Math.min(sessions, 2);
        }
        if (preference.getSessionMinutes() < 25) {
            sessions = Math.min(sessions, 2);
        }
        return sessions;
    }

    private String deriveLoadStatus(double volume28d, Double acwr, boolean raceWeek, boolean conservativeMode) {
        if (raceWeek) {
            return "RACE_WEEK";
        }
        if (conservativeMode) {
            return "CONSERVATIVE";
        }
        if (acwr != null && acwr > 1.3) {
            return "SPIKING";
        }
        if (volume28d >= 200) {
            return "HIGH_VOLUME";
        }
        return "STEADY";
    }

    private String deriveRecoveryGate(AutomatedCoachService.CoachStateDto coachState) {
        Integer baseline = coachState.baselineRestingHr();
        Integer lastNight = coachState.lastNightRestingHr();
        Integer sleepScore = coachState.lastSleepScore();

        if (baseline != null && lastNight != null && baseline > 0) {
            if (lastNight > baseline * 1.08) {
                return "PROTECT";
            }
            if (lastNight > baseline * 1.04) {
                return "CAUTION";
            }
        }
        if (sleepScore != null) {
            if (sleepScore < 45) {
                return "PROTECT";
            }
            if (sleepScore < 65) {
                return "CAUTION";
            }
        }
        return "OPEN";
    }

    private String deriveCurrentFocus(MuscleTrainingPreference preference, String loadStatus, String recoveryGate) {
        if ("PROTECT".equals(recoveryGate) || "RACE_WEEK".equals(loadStatus)) {
            return "RECOVERY_CAPACITY";
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            return "QUIET_POSTERIOR_CHAIN";
        }
        if ("HIGH_VOLUME".equals(loadStatus)) {
            return "ELASTIC_STIFFNESS";
        }
        return "POSTERIOR_CHAIN_STABILITY";
    }

    private List<AssignedSession> assignSessions(
            MuscleTrainingPreference preference,
            PlanMetrics metrics,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> coachSchedule
    ) {
        List<AssignedSession> assignments = new ArrayList<>();
        for (String sessionType : desiredSessionTypes(preference, metrics)) {
            DayCandidate candidate = pickBestCandidate(sessionType, preference, metrics, coachSchedule, assignments);
            if (candidate == null) {
                continue;
            }
            SessionDefinitionDto session = buildSessionDefinition(sessionType, preference, metrics);
            assignments.add(new AssignedSession(
                    candidate.date(),
                    sessionType,
                    new StrengthAssignmentDto(
                            sessionType,
                            session.title(),
                            session.emphasis(),
                            session.durationMinutes(),
                            session.targetRpe(),
                            session.optional(),
                            isQuietCompatible(sessionType),
                            candidate.reasonCode(),
                            candidate.cautionCode()
                    )
            ));
        }
        assignments.sort(Comparator.comparing(AssignedSession::date));
        return assignments;
    }

    private List<String> desiredSessionTypes(MuscleTrainingPreference preference, PlanMetrics metrics) {
        if (metrics.recommendedSessionsPerWeek() <= 0) {
            return List.of();
        }
        if (metrics.recommendedSessionsPerWeek() == 1) {
            if ("PROTECT".equals(metrics.recoveryGate()) || metrics.raceWeek() || "SPIKING".equals(metrics.loadStatus())) {
                return List.of("RESILIENCE_CAPACITY");
            }
            return List.of("FOUNDATION_STRENGTH");
        }
        if (metrics.recommendedSessionsPerWeek() == 2) {
            return List.of("FOUNDATION_STRENGTH", "RESILIENCE_CAPACITY");
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            return List.of("FOUNDATION_STRENGTH", "RESILIENCE_CAPACITY");
        }
        return List.of("FOUNDATION_STRENGTH", "RESILIENCE_CAPACITY", "OPTIONAL_ELASTICITY");
    }

    private DayCandidate pickBestCandidate(
            String sessionType,
            MuscleTrainingPreference preference,
            PlanMetrics metrics,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> coachSchedule,
            List<AssignedSession> existing
    ) {
        DayCandidate best = null;
        for (int i = 0; i < coachSchedule.size(); i++) {
            AutomatedCoachService.CoachScheduledWorkoutDto day = coachSchedule.get(i);
            if (existing.stream().anyMatch(item -> item.date().equals(day.scheduledDate()))) {
                continue;
            }
            if (!hasRequiredSpacing(day.scheduledDate(), sessionType, existing)) {
                continue;
            }
            AutomatedCoachService.CoachScheduledWorkoutDto prev = i > 0 ? coachSchedule.get(i - 1) : null;
            AutomatedCoachService.CoachScheduledWorkoutDto next = i + 1 < coachSchedule.size() ? coachSchedule.get(i + 1) : null;

            DayCandidate candidate = scoreCandidate(sessionType, preference, metrics, day, prev, next);
            if (candidate == null) {
                continue;
            }
            if (best == null || candidate.score() < best.score()) {
                best = candidate;
            }
        }
        return best;
    }

    private boolean hasRequiredSpacing(LocalDate date, String sessionType, List<AssignedSession> existing) {
        long requiredGapDays = "OPTIONAL_ELASTICITY".equals(sessionType) ? 1 : 2;
        for (AssignedSession item : existing) {
            long gap = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(item.date(), date));
            if (gap < requiredGapDays) {
                return false;
            }
        }
        return true;
    }

    private DayCandidate scoreCandidate(
            String sessionType,
            MuscleTrainingPreference preference,
            PlanMetrics metrics,
            AutomatedCoachService.CoachScheduledWorkoutDto day,
            AutomatedCoachService.CoachScheduledWorkoutDto prev,
            AutomatedCoachService.CoachScheduledWorkoutDto next
    ) {
        if (isKeyRun(day.workoutType()) || isLongRun(day.workoutType())) {
            return null;
        }
        if ("OPTIONAL_ELASTICITY".equals(sessionType)
                && preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            return null;
        }

        int score;
        String reasonCode;

        switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> {
                if (!isFoundationFriendly(day.workoutType())) {
                    return null;
                }
                score = switch (day.workoutType()) {
                    case "EASY" -> 0;
                    case "RECOVERY" -> 1;
                    case "CROSS_TRAIN" -> 2;
                    case "REST" -> 3;
                    default -> 8;
                };
                reasonCode = "ASSIGN_AFTER_EASY_RUN";
            }
            case "RESILIENCE_CAPACITY" -> {
                if (!isFoundationFriendly(day.workoutType())) {
                    return null;
                }
                score = switch (day.workoutType()) {
                    case "RECOVERY", "CROSS_TRAIN" -> 0;
                    case "REST" -> 1;
                    case "EASY" -> 2;
                    default -> 8;
                };
                reasonCode = "ASSIGN_ON_RECOVERY_DAY";
            }
            case "OPTIONAL_ELASTICITY" -> {
                if (!Objects.equals(day.workoutType(), CoachWorkoutType.EASY.name())
                        && !Objects.equals(day.workoutType(), CoachWorkoutType.CROSS_TRAIN.name())) {
                    return null;
                }
                score = Objects.equals(day.workoutType(), CoachWorkoutType.EASY.name()) ? 1 : 0;
                reasonCode = "ASSIGN_OPTIONAL_LOW_IMPACT_SLOT";
            }
            default -> {
                return null;
            }
        }

        if (next != null && (isKeyRun(next.workoutType()) || isLongRun(next.workoutType()))) {
            return null;
        }
        if (prev != null && (isKeyRun(prev.workoutType()) || isLongRun(prev.workoutType()))) {
            score += "FOUNDATION_STRENGTH".equals(sessionType) ? 3 : 1;
        }
        if (day.readinessAdjusted()) {
            score += 3;
        }
        if ("CAUTION".equals(metrics.recoveryGate())) {
            score += 1;
        }
        if ("PROTECT".equals(metrics.recoveryGate()) && "FOUNDATION_STRENGTH".equals(sessionType)) {
            score += 4;
        }
        if (preference.getPreferredStrengthDays().contains(day.scheduledDate().getDayOfWeek())) {
            score -= 2;
        }

        String caution = null;
        if ("CAUTION".equals(metrics.recoveryGate()) || "SPIKING".equals(metrics.loadStatus())) {
            caution = "CAUTION_KEEP_SUBMAXIMAL";
        }
        if (metrics.raceWeek()) {
            caution = "CAUTION_RACE_WEEK";
        }

        return new DayCandidate(day.scheduledDate(), score, reasonCode, caution);
    }

    private boolean isFoundationFriendly(String workoutType) {
        return Objects.equals(workoutType, CoachWorkoutType.EASY.name())
                || Objects.equals(workoutType, CoachWorkoutType.RECOVERY.name())
                || Objects.equals(workoutType, CoachWorkoutType.CROSS_TRAIN.name())
                || Objects.equals(workoutType, CoachWorkoutType.REST.name());
    }

    private String explainNoStrengthReason(
            LocalDate date,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule,
            PlanMetrics metrics,
            List<AssignedSession> assignments
    ) {
        AutomatedCoachService.CoachScheduledWorkoutDto current = schedule.stream()
                .filter(day -> day.scheduledDate().equals(date))
                .findFirst()
                .orElse(null);
        if (current == null) {
            return "SKIP_BUFFER_DAY";
        }
        if (isKeyRun(current.workoutType())) {
            return "SKIP_KEY_RUN_DAY";
        }
        if (isLongRun(current.workoutType())) {
            return "SKIP_LONG_RUN_DAY";
        }

        AutomatedCoachService.CoachScheduledWorkoutDto next = schedule.stream()
                .filter(day -> day.scheduledDate().equals(date.plusDays(1)))
                .findFirst()
                .orElse(null);
        if (next != null && isKeyRun(next.workoutType())) {
            return "SKIP_KEY_RUN_TOMORROW";
        }
        if (next != null && isLongRun(next.workoutType())) {
            return "SKIP_LONG_RUN_TOMORROW";
        }
        if (metrics.recommendedSessionsPerWeek() <= 0) {
            return "SKIP_RECOVERY_GATE";
        }
        if (assignments.size() >= metrics.recommendedSessionsPerWeek()) {
            return "SKIP_SESSION_CAP_REACHED";
        }
        return "SKIP_BUFFER_DAY";
    }

    private List<String> buildRationaleCodes(
            MuscleTrainingPreference preference,
            PlanMetrics metrics,
            List<AssignedSession> assignments
    ) {
        List<String> rationale = new ArrayList<>();
        rationale.add("R_VOLUME_28D");
        rationale.add("R_COACH_SCHEDULE");
        rationale.add("R_EQUIPMENT_FILTER");

        if (metrics.conservativeMode()) {
            rationale.add("R_CONSERVATIVE_DATA");
        }
        if (!"OPEN".equals(metrics.recoveryGate())) {
            rationale.add("R_RECOVERY_GATE");
        }
        if ("SPIKING".equals(metrics.loadStatus())) {
            rationale.add("R_LOAD_SPIKE");
        }
        if ("HIGH_VOLUME".equals(metrics.loadStatus())) {
            rationale.add("R_HIGH_VOLUME");
        }
        if (metrics.raceWeek()) {
            rationale.add("R_RACE_WEEK");
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            rationale.add("R_QUIET_FILTER");
        }
        if (assignments.isEmpty()) {
            rationale.add("R_SKIP_WEEK");
        }
        return rationale;
    }

    private SessionDefinitionDto buildSessionDefinition(
            String sessionType,
            MuscleTrainingPreference preference,
            PlanMetrics metrics
    ) {
        int targetRpe = targetRpe(preference, sessionType, metrics);
        int duration = sessionDurationMinutes(preference, sessionType, metrics);
        boolean shortSession = duration <= 25;

        List<BlockDto> blocks = switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> buildFoundationBlocks(preference, targetRpe, shortSession);
            case "RESILIENCE_CAPACITY" -> buildResilienceBlocks(preference, targetRpe, shortSession);
            case "OPTIONAL_ELASTICITY" -> buildElasticityBlocks(preference, targetRpe);
            default -> List.of();
        };

        return new SessionDefinitionDto(
                sessionType,
                titleForSession(sessionType),
                emphasisForSession(sessionType, preference, metrics),
                duration,
                targetRpe,
                "OPTIONAL_ELASTICITY".equals(sessionType) || "PROTECT".equals(metrics.recoveryGate()) || metrics.raceWeek(),
                blocks
        );
    }

    private String titleForSession(String sessionType) {
        return switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> "Foundation strength";
            case "RESILIENCE_CAPACITY" -> "Resilience capacity";
            case "OPTIONAL_ELASTICITY" -> "Optional elasticity";
            default -> "Strength session";
        };
    }

    private String emphasisForSession(String sessionType, MuscleTrainingPreference preference, PlanMetrics metrics) {
        return switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> "Single-leg strength, posterior chain, calf resilience";
            case "RESILIENCE_CAPACITY" -> "Tissue capacity, trunk control, and low-cost durability";
            case "OPTIONAL_ELASTICITY" -> preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY
                    ? "Quiet coordination and fast contacts"
                    : "Elastic return, fast contacts, and stiffness";
            default -> metrics.currentFocus();
        };
    }

    private int sessionDurationMinutes(MuscleTrainingPreference preference, String sessionType, PlanMetrics metrics) {
        int base = switch (sessionType) {
            case "FOUNDATION_STRENGTH" -> Math.min(45, preference.getSessionMinutes());
            case "RESILIENCE_CAPACITY" -> Math.min(35, preference.getSessionMinutes());
            case "OPTIONAL_ELASTICITY" -> Math.min(22, preference.getSessionMinutes());
            default -> preference.getSessionMinutes();
        };

        if ("PROTECT".equals(metrics.recoveryGate()) || metrics.raceWeek()) {
            base = Math.max(18, base - 8);
        }
        return base;
    }

    private int targetRpe(MuscleTrainingPreference preference, String sessionType, PlanMetrics metrics) {
        int base = switch (preference.getExperienceLevel()) {
            case BEGINNER -> 6;
            case INTERMEDIATE -> 7;
            case CONSISTENT -> 8;
        };
        if ("RESILIENCE_CAPACITY".equals(sessionType)) {
            base = Math.max(5, base - 1);
        }
        if ("OPTIONAL_ELASTICITY".equals(sessionType)) {
            base = Math.max(5, Math.min(7, base));
        }
        if ("CAUTION".equals(metrics.recoveryGate())) {
            base = Math.max(5, base - 1);
        }
        if ("PROTECT".equals(metrics.recoveryGate()) || metrics.raceWeek()) {
            base = Math.max(5, base - 2);
        }
        return base;
    }

    private List<BlockDto> buildFoundationBlocks(MuscleTrainingPreference preference, int targetRpe, boolean shortSession) {
        List<ExerciseDto> warmup = new ArrayList<>(List.of(
                exercise("Hip airplanes", 2, shortSession ? "4/side" : "5/side", 5, "Slow hinge, own the balance", "QUIET", "BODYWEIGHT",
                        "Use fingertip support and shorten the hip rotation.", "Remove support or add a 2-second pause in each open position."),
                exercise("Ankle dorsiflexion rocks", 2, "8/side", 4, "Controlled ankle motion", "QUIET", "BODYWEIGHT",
                        "Limit range and keep the heel lightly loaded.", "Move the knee further forward while the heel stays planted."),
                exercise("Dead bug", 2, shortSession ? "5/side" : "6/side", 5, "Exhale and keep ribs down", "QUIET", "BODYWEIGHT",
                        "Tap the heel instead of extending the full leg.", "Extend slower or hold the reach for 2 seconds.")
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Split squat", strengthSets(preference, shortSession), repsForStrength(preference, shortSession), targetRpe, "3-1-1 tempo", "QUIET", equipmentLabel(preference),
                        "Use bodyweight and shorten depth until the front knee tracks cleanly.", "Add load or add a 2-second pause at the bottom."),
                exercise("Single-leg Romanian deadlift", strengthSets(preference, shortSession), repsForStrength(preference, shortSession), targetRpe, "Reach long, hinge from the hips", "QUIET", equipmentLabel(preference),
                        "Use a kickstand or light wall support.", "Add load or increase the forward reach without losing hip control."),
                exercise("Standing calf raise", strengthSets(preference, shortSession), shortSession ? "10" : "12", targetRpe, "2 up / 2 down with full pause", "QUIET", "BODYWEIGHT",
                        "Use both legs and reduce the pause length.", "Bias one leg at a time or add load when the top position stays crisp.")
        ));

        if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.BAND
                || preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.GYM) {
            main.add(exercise("Pallof press", 2 + strengthSetBonus(preference), shortSession ? "8/side" : "10/side", Math.max(5, targetRpe - 1), "Brace, press, resist rotation", "QUIET", "BAND",
                    "Shorten the press range or step closer to the anchor.", "Step further from the anchor or hold the press for 2 seconds."));
        } else {
            main.add(exercise("Side plank", 2 + strengthSetBonus(preference), shortSession ? "20s/side" : "25s/side", Math.max(5, targetRpe - 1), "Stack ribs over pelvis", "QUIET", "BODYWEIGHT",
                    "Bend the bottom knee for extra support.", "Lift the top leg or extend the hold if you stay stable."));
        }

        List<BlockDto> blocks = new ArrayList<>();
        blocks.add(new BlockDto("Prep", warmup));
        blocks.add(new BlockDto("Main", main));

        if (!shortSession) {
            List<ExerciseDto> accessory = new ArrayList<>(List.of(
                    exercise("Glute bridge (pause at top)", 2, "10", Math.max(5, targetRpe - 1), "Drive up, 2-second pause", "QUIET", "BODYWEIGHT",
                            "Use a shorter range and keep both feet close to the hips.", "March from the bridge or load the hips once the pause is stable."),
                    exercise("Tibialis wall raise", 2, "15", 5, "Smooth up, controlled down", "QUIET", "BODYWEIGHT",
                            "Stand more upright with less shin angle.", "Lean further back or add a longer lower phase.")
            ));
            if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.GYM) {
                accessory.add(exercise("Hamstring curl (slider or machine)", 2, "8-10", Math.max(5, targetRpe - 1), "Smooth curl, slow return", "QUIET", "GYM",
                        "Use a reduced range or keep the hips lower.", "Add a bridge hold or progress to slower eccentrics."));
            }
            blocks.add(new BlockDto("Accessory", accessory));
        }

        return blocks;
    }

    private List<BlockDto> buildResilienceBlocks(MuscleTrainingPreference preference, int targetRpe, boolean shortSession) {
        List<ExerciseDto> prep = new ArrayList<>(List.of(
                exercise("World’s greatest stretch", 2, "4/side", 4, "Move slowly and breathe", "QUIET", "BODYWEIGHT",
                        "Reduce the rotation and keep the back knee down.", "Pause at end-range for 2 breaths."),
                exercise("Ankle dorsiflexion rocks", 2, "10/side", 4, "Own the end range", "QUIET", "BODYWEIGHT",
                        "Use a smaller rock and hold onto support.", "Drive further forward without losing the heel.")
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Step-down (knee tracking)", 2 + strengthSetBonus(preference), shortSession ? "6/side" : "8/side", Math.max(5, targetRpe - 1), "Slow lower, clean knee path", "QUIET", "BODYWEIGHT",
                        "Use a lower step or limit the touch depth.", "Increase step height or add load when control stays clean.")
        ));

        if (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.BODYWEIGHT) {
            main.add(exercise("Glute bridge (pause at top)", 2, "10", Math.max(5, targetRpe - 1), "2-second pause every rep", "QUIET", "BODYWEIGHT",
                    "Use a short bridge with both heels closer in.", "Progress to single-leg emphasis or longer pauses."));
            main.add(exercise("Side plank", 2, shortSession ? "20s/side" : "25s/side", Math.max(5, targetRpe - 1), "Quiet trunk, steady breath", "QUIET", "BODYWEIGHT",
                    "Bend the bottom knee for support.", "Lift the top leg or extend the duration."));
        } else {
            main.add(exercise("Hamstring curl (slider or machine)", 2 + strengthSetBonus(preference), shortSession ? "8" : "10", Math.max(5, targetRpe - 1), "Control the eccentric", "QUIET", equipmentLabel(preference),
                    "Reduce the range and keep hips slightly lower.", "Add a bridge hold or slow the return."));
            main.add(exercise("Pallof press", 2 + strengthSetBonus(preference), shortSession ? "8/side" : "10/side", Math.max(5, targetRpe - 1), "Press and resist rotation", "QUIET", "BAND",
                    "Shorten the lever by keeping hands closer to the chest.", "Step away from the anchor or extend the hold."));
        }

        main.add(exercise("Tibialis wall raise", 2, "15", 5, "Full toe lift each rep", "QUIET", "BODYWEIGHT",
                "Stand more upright against the wall.", "Increase lean and keep the lowering slower."));

        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.NORMAL
                && (preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.DUMBBELL
                || preference.getEquipmentLevel() == MuscleTrainingPreference.EquipmentLevel.GYM)
                && !shortSession) {
            main.add(exercise("Farmer carry (suitcase)", 3, "20-30m/side", Math.max(5, targetRpe - 1), "Tall posture, no side bend", "SOUND", "DUMBBELL",
                    "Use a lighter load and a shorter carry lane.", "Carry heavier or add a longer distance without leaning."));
        }

        return List.of(
                new BlockDto("Prep", prep),
                new BlockDto("Main", main)
        );
    }

    private List<BlockDto> buildElasticityBlocks(MuscleTrainingPreference preference, int targetRpe) {
        List<ExerciseDto> prep = new ArrayList<>(List.of(
                exercise("Pogo hops", 2, "10", Math.max(5, targetRpe - 1), "Short, light, springy contacts", "SOUND", "BODYWEIGHT",
                        "Turn it into rapid calf raises without leaving the ground.", "Increase rebound stiffness, not jump height."),
                exercise("Skipping A-drill", 2, "15m", Math.max(5, targetRpe - 1), "Rhythm first, then height", "SOUND", "BODYWEIGHT",
                        "March the pattern instead of skipping.", "Increase speed while keeping the contacts crisp.")
        ));

        List<ExerciseDto> main = new ArrayList<>(List.of(
                exercise("Box step-up (explosive)", 3, "5/side", targetRpe, "Fast up, soft down", "SOUND", equipmentLabel(preference),
                        "Use a lower step and control the drive.", "Use a higher step or add light load without stomping."),
                exercise("Single-leg hop (low amplitude)", 3, "5/side", targetRpe, "Quick elastic contacts", "SOUND", "BODYWEIGHT",
                        "Use double-leg pogo contacts instead.", "Increase the number of crisp contacts, not the height.")
        ));

        return List.of(
                new BlockDto("Prep", prep),
                new BlockDto("Main", main)
        );
    }

    private ExerciseDto exercise(
            String name,
            int sets,
            String repsOrDuration,
            int targetRpe,
            String tempoOrIntent,
            String noiseLevel,
            String equipmentNeeded,
            String regression,
            String progression
    ) {
        return new ExerciseDto(name, sets, repsOrDuration, targetRpe, tempoOrIntent, noiseLevel, equipmentNeeded, regression, progression);
    }

    private int strengthSets(MuscleTrainingPreference preference, boolean shortSession) {
        int base = switch (preference.getExperienceLevel()) {
            case BEGINNER -> 2;
            case INTERMEDIATE, CONSISTENT -> 3;
        };
        return shortSession ? Math.max(2, base - 1) : base;
    }

    private int strengthSetBonus(MuscleTrainingPreference preference) {
        return preference.getExperienceLevel() == MuscleTrainingPreference.ExperienceLevel.CONSISTENT ? 1 : 0;
    }

    private String repsForStrength(MuscleTrainingPreference preference, boolean shortSession) {
        return switch (preference.getExperienceLevel()) {
            case BEGINNER -> shortSession ? "6/side" : "7/side";
            case INTERMEDIATE -> shortSession ? "6/side" : "8/side";
            case CONSISTENT -> shortSession ? "7/side" : "8/side";
        };
    }

    private String equipmentLabel(MuscleTrainingPreference preference) {
        return switch (preference.getEquipmentLevel()) {
            case BODYWEIGHT -> "BODYWEIGHT";
            case BAND -> "BAND";
            case DUMBBELL -> "DUMBBELL";
            case GYM -> "GYM";
        };
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

    private Double computeAcwr(List<Activity> runs) {
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(119);
        Map<LocalDate, Double> dailyLoads = new LinkedHashMap<>();

        for (Activity run : runs) {
            LocalDate date = resolveLocalDate(run);
            if (date == null || date.isBefore(start) || date.isAfter(today)) {
                continue;
            }
            double load = estimateLoad(run);
            if (load <= 0) {
                continue;
            }
            dailyLoads.merge(date, load, Double::sum);
        }

        if (dailyLoads.isEmpty()) {
            return null;
        }

        double ewmaA = 0;
        double ewmaC = 0;
        Double lastAcwr = null;
        double lambdaA = 2.0 / 8.0;
        double lambdaC = 2.0 / 29.0;

        for (LocalDate day = start; !day.isAfter(today); day = day.plusDays(1)) {
            double load = dailyLoads.getOrDefault(day, 0.0);
            if (day.equals(start)) {
                ewmaA = load;
                ewmaC = load;
            } else {
                ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
                ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
            }
            lastAcwr = ewmaC > 0.5 ? ewmaA / ewmaC : null;
        }

        return lastAcwr;
    }

    private double estimateLoad(Activity activity) {
        double km = distanceKm(activity);
        int movingSec = activity.getMovingTimeSeconds();
        if (movingSec <= 0 && activity.getDurationSeconds() != null) {
            movingSec = activity.getDurationSeconds().intValue();
        }
        if (km <= 0 || movingSec <= 0) {
            return 0;
        }

        double paceSecPerKm = movingSec / km;
        double velocity = (1000.0 / paceSecPerKm) * 60.0;
        double vo2 = -4.60 + (0.182258 * velocity) + (0.000104 * velocity * velocity);
        double vo2Fraction = Math.max(0.42, Math.min(1.2, vo2 / 50.0));
        double intensityRatio = vo2Fraction / 0.85;
        return (movingSec / 3600.0) * intensityRatio * intensityRatio * 100.0;
    }

    private int countRecentHardRuns(List<Activity> runs, AutomatedCoachService.CoachStateDto coachState) {
        double hrMax = coachState.profileMaxHeartRateBpm() != null && coachState.profileMaxHeartRateBpm() >= 130
                ? CoachHrZoneClassifier.clampHrMax(coachState.profileMaxHeartRateBpm())
                : 185;

        LocalDate cutoff = LocalDate.now().minusDays(6);
        int hard = 0;
        for (Activity run : runs) {
            LocalDate date = resolveLocalDate(run);
            if (date == null || date.isBefore(cutoff)) {
                continue;
            }
            if (distanceKm(run) >= 16) {
                hard++;
                continue;
            }
            CoachHrBand band = CoachHrZoneClassifier.classify(run.getAverageHeartRate(), hrMax);
            if (band == CoachHrBand.HIGH || band == CoachHrBand.GREY) {
                hard++;
            }
        }
        return hard;
    }

    private List<Activity> runsWithinDays(List<Activity> runs, int days) {
        LocalDate cutoff = LocalDate.now().minusDays(days - 1L);
        return runs.stream()
                .filter(run -> {
                    LocalDate date = resolveLocalDate(run);
                    return date != null && !date.isBefore(cutoff);
                })
                .toList();
    }

    private LocalDate resolveLocalDate(Activity activity) {
        if (activity.getStartTime() != null) {
            return activity.getStartTime().toLocalDate();
        }
        if (activity.getCreatedAt() != null) {
            return activity.getCreatedAt().toLocalDate();
        }
        return null;
    }

    private double distanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private record PlanMetrics(
            double volumeKm7d,
            double volumeKm28d,
            Double acwr,
            Double highIntensityRatioLast7d,
            String recoveryGate,
            String loadStatus,
            boolean conservativeMode,
            boolean raceWeek,
            int recommendedSessionsPerWeek,
            String currentFocus,
            LocalDate nextKeyRunDate,
            String nextKeyRunType,
            LocalDate nextLongRunDate,
            Double nextLongRunKm,
            int recentHardRunCount7d
    ) {}

    private record DayCandidate(LocalDate date, int score, String reasonCode, String cautionCode) {}

    private record AssignedSession(LocalDate date, String sessionType, StrengthAssignmentDto strength) {}

    public record MuscleProfileUpdate(
            String experienceLevel,
            String equipmentLevel,
            Integer sessionMinutes,
            String noisePreference,
            List<String> preferredStrengthDays
    ) {}

    public record MuscleProfileDto(
            String experienceLevel,
            String equipmentLevel,
            int sessionMinutes,
            String noisePreference,
            List<String> preferredStrengthDays
    ) {}

    public record TodayCheckInUpdate(
            String runType,
            String entryState,
            Double distanceKm,
            Integer durationMinutes
    ) {}

    public record TodayCheckInDto(
            LocalDate trainingDate,
            String runType,
            String entryState,
            Double distanceKm,
            Integer durationMinutes,
            LocalDateTime updatedAt
    ) {}

    public record MuscleWeekContextDto(
            double volumeKm7d,
            double volumeKm28d,
            Double acwr,
            Double highIntensityRatioLast7d,
            String loadStatus,
            String recoveryGate,
            int recommendedSessionsPerWeek,
            String currentFocus,
            boolean conservativeMode,
            boolean raceWeek,
            LocalDate nextKeyRunDate,
            String nextKeyRunType,
            LocalDate nextLongRunDate,
            Double nextLongRunKm,
            int recentHardRunCount7d
    ) {}

    public record RunPlanDto(
            String workoutType,
            Double plannedDistanceKm,
            Integer plannedDurationMinutes,
            boolean keyRun,
            boolean longRun,
            boolean readinessAdjusted,
            String notes,
            String planSource
    ) {}

    public record StrengthAssignmentDto(
            String sessionType,
            String title,
            String emphasis,
            int durationMinutes,
            int targetRpe,
            boolean optional,
            boolean quietCompatible,
            String placementReasonCode,
            String cautionCode
    ) {}

    public record MuscleDayPlanDto(
            LocalDate date,
            String dayLabel,
            RunPlanDto run,
            StrengthAssignmentDto strength,
            String noStrengthReasonCode
    ) {}

    public record ExerciseDto(
            String name,
            int sets,
            String repsOrDuration,
            int targetRpe,
            String tempoOrIntent,
            String noiseLevel,
            String equipmentNeeded,
            String regression,
            String progression
    ) {}

    public record BlockDto(String title, List<ExerciseDto> exercises) {}

    public record SessionDefinitionDto(
            String sessionType,
            String title,
            String emphasis,
            int durationMinutes,
            int targetRpe,
            boolean optional,
            List<BlockDto> blocks
    ) {}

    public record MusclePlanDto(
            MuscleProfileDto profile,
            MuscleWeekContextDto weekContext,
            List<MuscleDayPlanDto> days,
            List<SessionDefinitionDto> sessions,
            List<String> rationale,
            TodayCheckInDto todayCheckIn,
            String planSource
    ) {}
}
