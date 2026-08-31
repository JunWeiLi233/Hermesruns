package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:muscle-training-controller-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@Transactional
class MuscleTrainingControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RunnerRepository runnerRepository;

    @Autowired
    private ShoeRepository shoeRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private MuscleTrainingPreferenceRepository preferenceRepository;

    @Autowired
    private MuscleTrainingCheckInRepository checkInRepository;

    @Autowired
    private CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;

    @Autowired
    private CoachRunnerStateRepository coachRunnerStateRepository;

    @Autowired
    private CoachTrainingBlockRepository coachTrainingBlockRepository;

    @Autowired
    private AuthService authService;

    @BeforeEach
    void clearData() {
        shoeRepository.deleteAll();
        coachScheduledWorkoutRepository.deleteAll();
        coachTrainingBlockRepository.deleteAll();
        coachRunnerStateRepository.deleteAll();
        checkInRepository.deleteAll();
        preferenceRepository.deleteAll();
        activityRepository.deleteAll();
        runnerRepository.deleteAll();
    }

    @Test
    void profileEndpointsPersistUpdates() throws Exception {
        Runner runner = createRunner("muscle-profile@test.local");

        mockMvc.perform(get("/api/training/muscle/profile")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experienceLevel").value("BEGINNER"))
                .andExpect(jsonPath("$.equipmentLevel").value("BODYWEIGHT"))
                .andExpect(jsonPath("$.sessionMinutes").value(30))
                .andExpect(jsonPath("$.noisePreference").value("NORMAL"));

        mockMvc.perform(put("/api/training/muscle/profile")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "experienceLevel", "CONSISTENT",
                                "equipmentLevel", "DUMBBELL",
                                "sessionMinutes", 40,
                                "noisePreference", "QUIET_ONLY",
                                "preferredStrengthDays", List.of("TUESDAY", "FRIDAY")
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experienceLevel").value("CONSISTENT"))
                .andExpect(jsonPath("$.equipmentLevel").value("DUMBBELL"))
                .andExpect(jsonPath("$.sessionMinutes").value(40))
                .andExpect(jsonPath("$.noisePreference").value("QUIET_ONLY"))
                .andExpect(jsonPath("$.preferredStrengthDays[0]").value("TUESDAY"))
                .andExpect(jsonPath("$.preferredStrengthDays[1]").value("FRIDAY"));

        MuscleTrainingPreference saved = preferenceRepository.findByRunner(runner).orElseThrow();
        assertThat(saved.getExperienceLevel()).isEqualTo(MuscleTrainingPreference.ExperienceLevel.CONSISTENT);
        assertThat(saved.getEquipmentLevel()).isEqualTo(MuscleTrainingPreference.EquipmentLevel.DUMBBELL);
        assertThat(saved.getSessionMinutes()).isEqualTo(40);
        assertThat(saved.getNoisePreference()).isEqualTo(MuscleTrainingPreference.NoisePreference.QUIET_ONLY);
        assertThat(saved.getPreferredStrengthDays()).containsExactlyInAnyOrder(
                java.time.DayOfWeek.TUESDAY,
                java.time.DayOfWeek.FRIDAY
        );
    }

    @Test
    void planAppliesPersonalizedStrengthDecisionToLiveContract() throws Exception {
        Runner runner = createRunner("muscle-strength-engine@test.local");
        seedRecentRuns(runner, 8, 8.0, 50);
        seedSchedule(runner, java.util.Collections.nCopies(28, CoachWorkoutType.REST));

        mockMvc.perform(put("/api/training/muscle/profile")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "experienceLevel", "BEGINNER",
                                "equipmentLevel", "DUMBBELL",
                                "sessionMinutes", 40,
                                "noisePreference", "NORMAL",
                                "preferredStrengthDays", List.of(LocalDate.now().getDayOfWeek().name())
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "REST",
                                "entryState", "PLANNED",
                                "strengthFocus", "POSTERIOR_CHAIN",
                                "strengthDose", "STRONG"
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.strengthCoachDecision.algorithmVersion").value("runner-strength-v1"))
                .andExpect(jsonPath("$.strengthCoachDecision.requestedFocus").value("POSTERIOR_CHAIN"))
                .andExpect(jsonPath("$.strengthCoachDecision.requestedDose").value("STRONG"))
                .andExpect(jsonPath("$.strengthCoachDecision.appliedFocus").value("POSTERIOR_CHAIN"))
                .andExpect(jsonPath("$.strengthCoachDecision.appliedDose").value("STANDARD"))
                .andExpect(jsonPath("$.strengthCoachDecision.safetyAction").value("DOWNGRADED"))
                .andExpect(jsonPath("$.days[0].strength.sessionType").value("CUSTOM_POSTERIOR_CHAIN_STANDARD"))
                .andExpect(jsonPath("$.sessions[0].sessionType").value("CUSTOM_POSTERIOR_CHAIN_STANDARD"))
                .andExpect(jsonPath("$.sessions[0].blocks[0].exercises").isNotEmpty());
    }

    @Test
    void planFallsBackToSingleQuietPersonalizedSessionForLowMileageQuietUser() throws Exception {
        Runner runner = createRunner("muscle-conservative@test.local");

        mockMvc.perform(put("/api/training/muscle/profile")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "experienceLevel", "BEGINNER",
                                "equipmentLevel", "BODYWEIGHT",
                                "sessionMinutes", 25,
                                "noisePreference", "QUIET_ONLY",
                                "preferredStrengthDays", List.of("MONDAY")
                        ))))
                .andExpect(status().isOk());

        String response = mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekContext.conservativeMode").value(true))
                .andExpect(jsonPath("$.weekContext.recommendedSessionsPerWeek").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        assertThat(root.path("rationale").toString()).contains("R_CONSERVATIVE_DATA", "R_QUIET_FILTER");
        assertThat(root.path("sessions")).hasSize(1);
        assertThat(root.path("sessions").get(0).path("sessionType").asText()).isEqualTo("CUSTOM_LEG_DAY_STANDARD");
        assertThat(root.path("sessions").get(0).path("blocks").toString()).doesNotContain("SOUND");

        long assignedStrengthDays = 0;
        for (JsonNode day : root.path("days")) {
            if (!day.path("strength").isMissingNode() && !day.path("strength").isNull()) {
                assignedStrengthDays++;
                assertThat(day.path("strength").path("sessionType").asText()).isEqualTo("CUSTOM_LEG_DAY_STANDARD");
            }
        }
        assertThat(assignedStrengthDays).isEqualTo(1);
    }

    @Test
    void planAvoidsKeyRunAndLongRunAdjacency() throws Exception {
        Runner runner = createRunner("muscle-placement@test.local");
        seedRecentRuns(runner, 8, 8.0, 55);
        // Weekly pattern chosen so exactly two buffer-legal strength days exist
        // per week (today and today+4, repeating): a strength day may not sit
        // on, directly after, or directly before a key run or long run, so
        // THRESHOLD sits at +2 and LONG_RUN at +6. Seeding the full 28-day
        // horizon matters twice over: the controller only takes the
        // schedule-preserving path once a today check-in exists, and the
        // strength engine drops to one conservative session per week unless
        // the schedule covers every day of the 28-day horizon.
        List<CoachWorkoutType> weeklyPattern = List.of(
                CoachWorkoutType.EASY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.THRESHOLD,
                CoachWorkoutType.RECOVERY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.LONG_RUN
        );
        List<CoachWorkoutType> horizon = new java.util.ArrayList<>();
        for (int week = 0; week < 4; week++) {
            horizon.addAll(weeklyPattern);
        }
        seedSchedule(runner, horizon);
        // Without a today check-in the controller regenerates the coach week,
        // so the seeded schedule never reaches the plan and the visible days
        // drift with the run date. A check-in switches the controller to the
        // schedule-preserving path, making the seeded week authoritative.
        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "EASY",
                                "entryState", "PLANNED",
                                "distanceKm", 8.0,
                                "durationMinutes", 48
                        ))))
                .andExpect(status().isOk());
        // The strength engine scores candidate days by weekday preference, so
        // with default preferences the second session can land beyond the
        // visible 7-day window depending on the run date. Pin the preference
        // to the two seeded free days (today and today+3) so the placement is
        // deterministic for any anchor date.
        mockMvc.perform(put("/api/training/muscle/profile")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "preferredStrengthDays", List.of(
                                        LocalDate.now().getDayOfWeek().name(),
                                        LocalDate.now().plusDays(4).getDayOfWeek().name()
                                )
                        ))))
                .andExpect(status().isOk());

        String response = mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekContext.recommendedSessionsPerWeek").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        JsonNode days = root.path("days");

        int qualityIndex = -1;
        int longRunIndex = -1;
        for (int index = 0; index < days.size(); index++) {
            String workoutType = days.get(index).path("run").path("workoutType").asText();
            if (List.of("TEMPO", "THRESHOLD", "INTERVALS").contains(workoutType)) qualityIndex = index;
            if ("LONG_RUN".equals(workoutType)) longRunIndex = index;
        }
        assertThat(qualityIndex).isGreaterThanOrEqualTo(0);
        assertThat(longRunIndex).isGreaterThanOrEqualTo(0);
        for (int protectedIndex : List.of(qualityIndex, longRunIndex)) {
            assertThat(hasNoStrength(days.get(protectedIndex))).isTrue();
            if (protectedIndex > 0) assertThat(hasNoStrength(days.get(protectedIndex - 1))).isTrue();
            if (protectedIndex + 1 < days.size()) assertThat(hasNoStrength(days.get(protectedIndex + 1))).isTrue();
        }

        long strengthDays = 0;
        JsonNode appliedDay = null;
        String appliedDate = root.path("strengthCoachDecision").path("appliedDate").asText();
        for (JsonNode day : days) {
            if (!day.path("strength").isNull() && !day.path("strength").isMissingNode()) {
                strengthDays++;
            }
            if (appliedDate.equals(day.path("date").asText())) {
                appliedDay = day;
            }
        }
        assertThat(strengthDays).isBetween(1L, 2L);
        assertThat(appliedDay).isNotNull();
        assertThat(hasNoStrength(appliedDay)).isFalse();
    }

    @Test
    void planCanSkipStrengthCompletelyOnProtectRaceWeek() throws Exception {
        Runner runner = createRunner("muscle-raceweek@test.local");

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setVolumeKm7d(42);
        state.setVolumeKm28d(150);
        state.setBaselineRestingHr(50);
        state.setLastNightRestingHr(60);
        state.setLastSleepScore(40);
        state.setLastAggregatedAt(LocalDateTime.now());
        coachRunnerStateRepository.save(state);

        CoachTrainingBlock block = new CoachTrainingBlock();
        block.setRunner(runner);
        block.setActive(true);
        block.setRaceDistanceKm(21.1);
        block.setTargetRaceDate(LocalDate.now().plusDays(3));
        block.setName("Half marathon");
        block.setWeekIndex(5);
        block.setCurrentLongRunKm(18);
        block.setBlockStartedOn(LocalDate.now().minusWeeks(5));
        coachTrainingBlockRepository.save(block);

        String response = mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekContext.recommendedSessionsPerWeek").value(0))
                .andExpect(jsonPath("$.weekContext.raceWeek").value(true))
                .andExpect(jsonPath("$.weekContext.recoveryGate").value("PROTECT"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        assertThat(root.path("rationale").toString()).contains("R_RACE_WEEK", "R_RECOVERY_GATE", "R_SKIP_WEEK");
        assertThat(root.path("strengthCoachDecision").path("appliedDate").isNull()).isTrue();
        assertThat(root.path("strengthCoachDecision").path("safetyAction").asText()).isEqualTo("SUPPRESSED");
        for (JsonNode day : root.path("days")) {
            assertThat(day.path("strength").isNull()).isTrue();
        }
    }

    @Test
    void todayCheckInEndpointsRoundTripAndClear() throws Exception {
        Runner runner = createRunner("muscle-checkin@test.local");

        mockMvc.perform(get("/api/training/muscle/today")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "EASY",
                                "entryState", "PLANNED",
                                "distanceKm", 8.0,
                                "durationMinutes", 48
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runType").value("EASY"))
                .andExpect(jsonPath("$.entryState").value("PLANNED"))
                .andExpect(jsonPath("$.distanceKm").value(8.0))
                .andExpect(jsonPath("$.durationMinutes").value(48));

        mockMvc.perform(get("/api/training/muscle/today")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runType").value("EASY"))
                .andExpect(jsonPath("$.entryState").value("PLANNED"));

        mockMvc.perform(delete("/api/training/muscle/today")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/training/muscle/today")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isNoContent());
    }

    @Test
    void checkInHistoryReturnsOnlyTheAuthenticatedRunnersMuscleActivity() throws Exception {
        Runner runner = createRunner("muscle-history@test.local");
        Runner otherRunner = createRunner("muscle-history-other@test.local");

        saveCheckIn(runner, LocalDate.now().minusDays(1), MuscleTrainingCheckIn.EntryState.PLANNED);
        saveCheckIn(runner, LocalDate.now().minusDays(2), MuscleTrainingCheckIn.EntryState.ACTUAL);
        saveCheckIn(runner, LocalDate.now(), MuscleTrainingCheckIn.EntryState.ACTUAL);
        saveCheckIn(otherRunner, LocalDate.now(), MuscleTrainingCheckIn.EntryState.ACTUAL);

        mockMvc.perform(get("/api/training/muscle/check-ins")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$[0].trainingDate").value(LocalDate.now().minusDays(2).toString()))
                .andExpect(jsonPath("$[0].entryState").value("ACTUAL"))
                .andExpect(jsonPath("$[1].trainingDate").value(LocalDate.now().toString()));
    }

    @Test
    void planUsesTodayCheckInAsSourceAndRestoresCoachScheduleWhenCleared() throws Exception {
        Runner runner = createRunner("muscle-source@test.local");
        seedRecentRuns(runner, 6, 8.0, 50);
        seedSchedule(runner, List.of(
                CoachWorkoutType.REST,
                CoachWorkoutType.EASY,
                CoachWorkoutType.RECOVERY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.REST,
                CoachWorkoutType.LONG_RUN,
                CoachWorkoutType.RECOVERY
        ));

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("COACH_SCHEDULE"))
                .andExpect(jsonPath("$.todayCheckIn").doesNotExist())
                .andExpect(jsonPath("$.days[0].run.planSource").value("COACH_SCHEDULE"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("REST"));

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "EASY",
                                "entryState", "PLANNED",
                                "distanceKm", 8.0
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("USER_PLANNED"))
                .andExpect(jsonPath("$.todayCheckIn.runType").value("EASY"))
                .andExpect(jsonPath("$.todayCheckIn.entryState").value("PLANNED"))
                .andExpect(jsonPath("$.days[0].run.planSource").value("USER_PLANNED"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("EASY"))
                .andExpect(jsonPath("$.days[0].run.plannedDistanceKm").value(8.0));

        mockMvc.perform(delete("/api/training/muscle/today")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("COACH_SCHEDULE"))
                .andExpect(jsonPath("$.todayCheckIn").doesNotExist())
                .andExpect(jsonPath("$.days[0].run.planSource").value("COACH_SCHEDULE"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("REST"));
    }

    @Test
    void actualLongRunAndQualityCheckInsBlockFormalStrengthAndKeepPlacementRules() throws Exception {
        Runner runner = createRunner("muscle-actual@test.local");
        seedRecentRuns(runner, 8, 8.0, 50);
        seedSchedule(runner, List.of(
                CoachWorkoutType.EASY,
                CoachWorkoutType.LONG_RUN,
                CoachWorkoutType.RECOVERY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.REST,
                CoachWorkoutType.EASY,
                CoachWorkoutType.RECOVERY
        ));

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "QUALITY",
                                "entryState", "PLANNED"
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("USER_PLANNED"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("QUALITY"))
                .andExpect(jsonPath("$.days[0].strength").doesNotExist())
                .andExpect(jsonPath("$.days[0].noStrengthReasonCode").value("SKIP_KEY_RUN_DAY"));

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "LONG_RUN",
                                "entryState", "ACTUAL",
                                "distanceKm", 18.5
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("USER_ACTUAL"))
                .andExpect(jsonPath("$.todayCheckIn.entryState").value("ACTUAL"))
                .andExpect(jsonPath("$.days[0].run.planSource").value("USER_ACTUAL"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("LONG_RUN"))
                .andExpect(jsonPath("$.days[0].strength").doesNotExist())
                .andExpect(jsonPath("$.days[0].noStrengthReasonCode").value("SKIP_LONG_RUN_DAY"))
                .andExpect(jsonPath("$.days[1].strength").doesNotExist())
                .andExpect(jsonPath("$.days[1].noStrengthReasonCode").value("SKIP_LONG_RUN_DAY"));
    }

    @Test
    void manualTodayCheckInStillAvoidsLongRunTomorrow() throws Exception {
        Runner runner = createRunner("muscle-checkin-adjacency@test.local");
        seedRecentRuns(runner, 8, 8.0, 50);
        seedRunsOnTomorrowWeekday(runner, 4, 8.0, 50);
        seedSchedule(runner, List.of(
                CoachWorkoutType.REST,
                CoachWorkoutType.LONG_RUN,
                CoachWorkoutType.RECOVERY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.REST,
                CoachWorkoutType.EASY,
                CoachWorkoutType.RECOVERY
        ));

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "EASY",
                                "entryState", "PLANNED",
                                "distanceKm", 8.0
                        ))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planSource").value("USER_PLANNED"))
                .andExpect(jsonPath("$.days[0].run.workoutType").value("EASY"))
                .andExpect(jsonPath("$.days[0].strength").doesNotExist())
                .andExpect(jsonPath("$.days[0].noStrengthReasonCode").value("SKIP_LONG_RUN_TOMORROW"));
    }

    @Test
    void invalidTodayCheckInValuesReturnBadRequest() throws Exception {
        Runner runner = createRunner("muscle-checkin-invalid@test.local");

        mockMvc.perform(put("/api/training/muscle/today")
                        .header("Authorization", bearer(runner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "runType", "EASY",
                                "entryState", "PLANNED",
                                "distanceKm", -1.0
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("distanceKm must be zero or greater."));
    }

    private Runner createRunner(String email) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setStatus("ACTIVE");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setCreatedAt(LocalDateTime.now());
        authService.storePassword(runner, "Password1!");
        return runnerRepository.save(runner);
    }

    private void saveCheckIn(Runner runner, LocalDate date, MuscleTrainingCheckIn.EntryState entryState) {
        MuscleTrainingCheckIn checkIn = new MuscleTrainingCheckIn();
        checkIn.setRunner(runner);
        checkIn.setTrainingDate(date);
        checkIn.setRunType(MuscleTrainingCheckIn.RunType.EASY);
        checkIn.setEntryState(entryState);
        checkInRepository.save(checkIn);
    }

    private void seedRecentRuns(Runner runner, int count, double distanceKm, int minutes) {
        for (int i = 0; i < count; i++) {
            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setMovingTimeSeconds(minutes * 60);
            activity.setStartTime(LocalDateTime.now().minusDays(i * 3L + 1L));
            activity.setAverageHeartRate(148.0);
            activityRepository.save(activity);
        }
    }

    private void seedRunsOnTomorrowWeekday(Runner runner, int count, double distanceKm, int minutes) {
        LocalDate firstMatchingDate = LocalDate.now().plusDays(1).minusWeeks(1);
        for (int i = 0; i < count; i++) {
            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setMovingTimeSeconds(minutes * 60);
            activity.setStartTime(firstMatchingDate.minusWeeks(i).atTime(7, 0));
            activity.setAverageHeartRate(148.0);
            activityRepository.save(activity);
        }
    }

    private boolean hasNoStrength(JsonNode day) {
        JsonNode strength = day.path("strength");
        return strength.isMissingNode() || strength.isNull();
    }

    private void seedSchedule(Runner runner, List<CoachWorkoutType> workoutTypes) {
        LocalDate today = LocalDate.now();
        for (int i = 0; i < workoutTypes.size(); i++) {
            CoachWorkoutType type = workoutTypes.get(i);
            CoachScheduledWorkout workout = new CoachScheduledWorkout();
            workout.setRunner(runner);
            workout.setScheduledDate(today.plusDays(i));
            workout.setWorkoutType(type);
            Double plannedDistanceKm = null;
            if (type == CoachWorkoutType.LONG_RUN) {
                plannedDistanceKm = 18.0;
            } else if (type != CoachWorkoutType.REST) {
                plannedDistanceKm = 8.0;
            }
            workout.setPlannedDistanceKm(plannedDistanceKm);
            workout.setPlannedDurationMinutes(type == CoachWorkoutType.REST ? null : 50);
            workout.setStridesSuggested(false);
            workout.setReadinessAdjusted(false);
            coachScheduledWorkoutRepository.save(workout);
        }
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }
}
