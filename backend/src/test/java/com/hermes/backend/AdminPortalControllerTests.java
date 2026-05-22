package com.hermes.backend;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin-portal-controller-tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver"
})
@Transactional
class AdminPortalControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RunnerRepository runnerRepository;

    @Autowired
    private ShoeRepository shoeRepository;

    @Autowired
    private RunnerAdminNoteRepository runnerAdminNoteRepository;

    @Autowired
    private AdminSavedFilterRepository adminSavedFilterRepository;

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
        adminSavedFilterRepository.deleteAll();
        runnerAdminNoteRepository.deleteAll();
        shoeRepository.deleteAll();
        adminBackgroundJobRepository.deleteAll();
        runnerRepository.deleteAll();
    }

    @Test
    void usersEndpointRejectsNonAdmin() throws Exception {
        Runner user = createRunner("user@test.local", "USER", true);

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("admin_required"));
    }

    @Test
    void usersEndpointReturnsPaginatedUsersAndQueueFilter() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        createRunner("needs-verify@test.local", "USER", false);
        createRunner("ok@test.local", "USER", true);

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", bearer(admin))
                        .param("queue", "recent_signup_issues"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].email").value("needs-verify@test.local"))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void addUserNoteCreatesNoteAndReturnsIt() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner user = createRunner("runner@test.local", "USER", true);

        mockMvc.perform(post("/api/admin/users/{id}/notes", user.getId())
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("noteText", "Investigating sync issue"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.noteText").value("Investigating sync issue"))
                .andExpect(jsonPath("$.authorEmail").value("admin@test.local"));

        assertThat(runnerAdminNoteRepository.findByRunnerIdOrderByCreatedAtDesc(user.getId())).hasSize(1);
    }

    @Test
    void impersonateUserIssuesSessionToken() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner user = createRunner("runner@test.local", "USER", true);

        mockMvc.perform(post("/api/admin/users/{id}/impersonate", user.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("runner@test.local"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.token").isString());

        Runner refreshed = runnerRepository.findById(user.getId()).orElseThrow();
        assertThat(refreshed.getSessionToken()).isNotBlank();
    }

    @Test
    void bulkGrantProSupportsDryRunAndApply() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner user = createRunner("runner@test.local", "USER", true);

        mockMvc.perform(post("/api/admin/users/bulk")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ids", java.util.List.of(user.getId()),
                                "action", "grant_pro",
                                "months", 2,
                                "dryRun", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(true))
                .andExpect(jsonPath("$.affected").value(1));

        mockMvc.perform(post("/api/admin/users/bulk")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ids", java.util.List.of(user.getId()),
                                "action", "grant_pro",
                                "months", 2,
                                "dryRun", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dryRun").value(false));

        Runner refreshed = runnerRepository.findById(user.getId()).orElseThrow();
        assertThat(refreshed.getSubscriptionTier()).isEqualTo("PRO");
        assertThat(refreshed.getProExpiresAt()).isAfter(LocalDateTime.now().plusMonths(1));
    }

    @Test
    void shoesEndpointSupportsMissingPhotoQueueAndBulkVerify() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner owner = createRunner("runner@test.local", "USER", true);
        Shoe missingPhoto = createShoe(owner, "Nike", "Pegasus 41", null, false);
        Shoe unverified = createShoe(owner, "ASICS", "Superblast", "https://example.com/shoe.png", false);

        mockMvc.perform(get("/api/admin/shoes")
                        .header("Authorization", bearer(admin))
                        .param("queue", "missing_photo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(missingPhoto.getId()));

        mockMvc.perform(post("/api/admin/shoes/bulk")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ids", java.util.List.of(unverified.getId()),
                                "action", "verify_photo",
                                "dryRun", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affected").value(1));

        Shoe refreshed = shoeRepository.findById(unverified.getId()).orElseThrow();
        assertThat(refreshed.isPhotoVerified()).isTrue();
    }

    @Test
    void saveAndDeleteFilterWorks() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);

        String response = mockMvc.perform(post("/api/admin/filters")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "scope", "users",
                                "name", "Billing queue",
                                "queryJson", "{\"queue\":\"billing_exceptions\"}"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Billing queue"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        long filterId = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(get("/api/admin/filters")
                        .header("Authorization", bearer(admin))
                        .param("scope", "users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(filterId));

        mockMvc.perform(delete("/api/admin/filters/{id}", filterId)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        assertThat(adminSavedFilterRepository.findAll()).isEmpty();
    }

    @Test
    void triggerStravaSyncCreatesTrackedJob() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);

        mockMvc.perform(post("/api/admin/jobs/strava-sync")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobType").value("STRAVA_GLOBAL_SYNC"))
                .andExpect(jsonPath("$.status").isString());

        assertThat(adminBackgroundJobRepository.findAll()).isNotEmpty();
    }

    private Runner createRunner(String email, String role, boolean emailVerified) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(emailVerified);
        runner.setCreatedAt(LocalDateTime.now());
        authService.storePassword(runner, "Password1!");
        return runnerRepository.save(runner);
    }

    private Shoe createShoe(Runner runner, String brand, String model, String photoUrl, boolean verified) {
        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setPhotoUrl(photoUrl);
        shoe.setPhotoVerified(verified);
        shoe.setRetired(false);
        shoe.setCreatedAt(LocalDateTime.now());
        return shoeRepository.save(shoe);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }
}
