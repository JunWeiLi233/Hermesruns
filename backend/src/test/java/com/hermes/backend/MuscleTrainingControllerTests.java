package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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
    void planFallsBackToSingleQuietFoundationForLowMileageQuietUser() throws Exception {
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
        assertThat(root.path("sessions").get(0).path("sessionType").asText()).isEqualTo("FOUNDATION_STRENGTH");
        assertThat(root.path("sessions").get(0).path("blocks").toString()).doesNotContain("SOUND");

        long assignedStrengthDays = 0;
        for (JsonNode day : root.path("days")) {
            if (!day.path("strength").isMissingNode() && !day.path("strength").isNull()) {
                assignedStrengthDays++;
                assertThat(day.path("strength").path("sessionType").asText()).isEqualTo("FOUNDATION_STRENGTH");
            }
        }
        assertThat(assignedStrengthDays).isEqualTo(1);
    }

    @Test
    void planAvoidsKeyRunAndLongRunAdjacency() throws Exception {
        Runner runner = createRunner("muscle-placement@test.local");
        seedRecentRuns(runner, 8, 8.0, 55);
        seedSchedule(runner, List.of(
                CoachWorkoutType.EASY,
                CoachWorkoutType.THRESHOLD,
                CoachWorkoutType.RECOVERY,
                CoachWorkoutType.EASY,
                CoachWorkoutType.REST,
                CoachWorkoutType.LONG_RUN,
                CoachWorkoutType.RECOVERY
        ));

        String response = mockMvc.perform(get("/api/training/muscle/plan")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekContext.recommendedSessionsPerWeek").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode root = objectMapper.readTree(response);
        JsonNode days = root.path("days");

        assertThat(days.get(1).path("run").path("workoutType").asText()).isEqualTo("THRESHOLD");
        assertThat(days.get(1).path("strength").isNull()).isTrue();
        assertThat(days.get(5).path("run").path("workoutType").asText()).isEqualTo("LONG_RUN");
        assertThat(days.get(5).path("strength").isNull()).isTrue();
        assertThat(days.get(0).path("strength").isNull()).isTrue();
        assertThat(days.get(4).path("strength").isNull()).isTrue();

        long strengthDays = 0;
        for (JsonNode day : days) {
            if (!day.path("strength").isNull()) {
                strengthDays++;
            }
        }
        assertThat(strengthDays).isEqualTo(2);
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
