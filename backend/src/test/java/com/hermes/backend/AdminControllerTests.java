package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-controller-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
@Transactional
public class AdminControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RunnerRepository runnerRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private AdminBackgroundJobRepository adminBackgroundJobRepository;

    @Autowired
    private CoachScheduledWorkoutRepository coachScheduledWorkoutRepository;

    @Autowired
    private CoachTrainingBlockRepository coachTrainingBlockRepository;

    @Autowired
    private CoachRunnerStateRepository coachRunnerStateRepository;

    @Autowired
    private AuthService authService;

    @BeforeEach
    void clearData() {
        coachScheduledWorkoutRepository.deleteAll();
        coachTrainingBlockRepository.deleteAll();
        coachRunnerStateRepository.deleteAll();
        activityRepository.deleteAll();
        adminBackgroundJobRepository.deleteAll();
        runnerRepository.deleteAll();
    }

    @Test
    void statsEndpointRejectsMissingAuthorization() throws Exception {
        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Admin privileges required."));
    }

    @Test
    void statsEndpointReturnsCountsAndRuntimeFieldsForAdmin() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN");
        Runner user = createRunner("runner@test.local", "USER");
        createRun(user, "Morning Run");

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(2))
                .andExpect(jsonPath("$.totalActivities").value(1))
                .andExpect(jsonPath("$.memoryUsedMb").isNumber())
                .andExpect(jsonPath("$.memoryTotalMb").isNumber())
                .andExpect(jsonPath("$.memoryMaxMb").isNumber())
                .andExpect(jsonPath("$.uptimeMillis").isNumber())
                .andExpect(jsonPath("$.osName").isString());
    }

    @Test
    void syncAllEndpointRejectsNonAdmin() throws Exception {
        Runner user = createRunner("user@test.local", "USER");

        mockMvc.perform(post("/api/admin/sync-all")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Admin privileges required."));
    }

    @Test
    void syncAllEndpointUsesLegacyTriggerSourceForAdmin() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN");

        String response = mockMvc.perform(post("/api/admin/sync-all")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Global Strava sync started."))
                .andExpect(jsonPath("$.jobId").isNumber())
                .andExpect(jsonPath("$.status").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        long jobId = objectMapper.readTree(response).get("jobId").asLong();
        AdminBackgroundJob job = adminBackgroundJobRepository.findById(jobId).orElseThrow();
        assertThat(job.getTriggerSource()).isEqualTo("legacy_admin_endpoint");
        assertThat(job.getCreatedByEmail()).isEqualTo("admin@test.local");
    }

    private Runner createRunner(String email, String role) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(true);
        runner.setCreatedAt(LocalDateTime.now());
        authService.storePassword(runner, "Password1!");
        return runnerRepository.save(runner);
    }

    private void createRun(Runner runner, String name) {
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setName(name);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(10.0);
        activity.setDistanceMeters(10_000.0);
        activity.setMovingTimeSeconds(2_700);
        activity.setStartTime(LocalDateTime.now().minusDays(1));
        activityRepository.save(activity);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }
}
