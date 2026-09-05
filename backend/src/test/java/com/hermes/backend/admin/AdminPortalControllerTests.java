package com.hermes.backend.admin;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.CoachRunnerStateRepository;
import com.hermes.backend.coaching.CoachScheduledWorkoutRepository;
import com.hermes.backend.coaching.CoachTrainingBlockRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.shoes.Shoe;
import com.hermes.backend.shoes.ShoeRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

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
    private ActivityRepository activityRepository;

    @Autowired
    private RunnerAdminNoteRepository runnerAdminNoteRepository;

    @Autowired
    private AdminSavedFilterRepository adminSavedFilterRepository;

    @Autowired
    private AdminAuditLogRepository adminAuditLogRepository;

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

    @Autowired
    private AdminPortalService adminPortalService;

    @BeforeEach
    void clearData() {
        clearAllData();
        // The dashboard payload cache lives outside the test transaction and
        // would otherwise leak the previous test method's snapshot.
        adminPortalService.invalidateDashboardCache();
    }

    // The Propagation.NOT_SUPPORTED cache tests below commit their seed data
    // for real, so their rows must be wiped afterwards; otherwise Hibernate's
    // insert-before-delete flush order makes later tests collide with the
    // committed unique emails. For the default rollback tests this is a no-op.
    @AfterEach
    void clearCommittedRows() {
        clearAllData();
    }

    private void clearAllData() {
        coachScheduledWorkoutRepository.deleteAll();
        coachTrainingBlockRepository.deleteAll();
        coachRunnerStateRepository.deleteAll();
        adminSavedFilterRepository.deleteAll();
        runnerAdminNoteRepository.deleteAll();
        activityRepository.deleteAll();
        shoeRepository.deleteAll();
        adminAuditLogRepository.deleteAll();
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

    @Test
    void clearJobsRemovesTerminalHistoryButPreservesActiveJobs() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        saveJob(AdminBackgroundJob.STATUS_COMPLETED);
        saveJob(AdminBackgroundJob.STATUS_FAILED);
        AdminBackgroundJob pending = saveJob(AdminBackgroundJob.STATUS_PENDING);
        AdminBackgroundJob running = saveJob(AdminBackgroundJob.STATUS_RUNNING);

        mockMvc.perform(delete("/api/admin/jobs")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(2))
                .andExpect(jsonPath("$.preservedActive").value(2));

        assertThat(adminBackgroundJobRepository.findAll())
                .extracting(AdminBackgroundJob::getId)
                .containsExactlyInAnyOrder(pending.getId(), running.getId());
    }

    @Test
    void adminCanDeleteOneAuditRecordFromServer() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        AdminAuditLog entry = new AdminAuditLog();
        entry.setActorRunnerId(admin.getId());
        entry.setActorEmail(admin.getEmail());
        entry.setActorRole(admin.getRole());
        entry.setAction("shoe.deleted");
        entry.setTargetType("shoe");
        entry.setTargetId("42");
        entry.setSummary("Admin permanently deleted shoe");
        Long auditId = adminAuditLogRepository.saveAndFlush(entry).getId();

        mockMvc.perform(delete("/api/admin/audit/{id}", auditId)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        assertThat(adminAuditLogRepository.findById(auditId))
                .isPresent()
                .get()
                .extracting(AdminAuditLog::getDeletedAt)
                .isNotNull();
    }

    @Test
    void adminCanClearAuditHistoryAndTheActionIsRecorded() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        saveAuditEntry(admin, "shoe.deleted", "shoe", "42");
        saveAuditEntry(admin, "catalog.model.created", "catalog_model", "7");

        mockMvc.perform(delete("/api/admin/audit")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(2));

        assertThat(adminAuditLogRepository.findAll()).hasSize(3);
        assertThat(adminAuditLogRepository.findAll().stream()
                .filter(entry -> entry.getDeletedAt() == null)
                .map(AdminAuditLog::getAction))
                .containsExactly("audit.history.cleared");
    }

    @Test
    void auditTrendIncludesEventsAfterTheirRowsAreDeleted() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        AdminAuditLog retainedInHistory = saveAuditEntry(admin, "shoe.deleted", "shoe", "42");
        AdminAuditLog deletedFromLiveList = saveAuditEntry(admin, "catalog.model.created", "catalog_model", "7");

        mockMvc.perform(delete("/api/admin/audit/{id}", deletedFromLiveList.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/audit/trend")
                        .header("Authorization", bearer(admin))
                        .param("days", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].createdAt").value(retainedInHistory.getCreatedAt().toLocalDate().toString()))
                .andExpect(jsonPath("$.items[0].count").value(2));
    }

    @Test
    void auditDeleteStillRequiresAdminAndReportsMissingRecord() throws Exception {
        Runner user = createRunner("user@test.local", "USER", true);

        mockMvc.perform(delete("/api/admin/audit/{id}", 999999L)
                        .header("Authorization", bearer(user)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("admin_required"));

        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        mockMvc.perform(delete("/api/admin/audit/{id}", 999999L)
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("audit_not_found"));
    }

    @Test
    void overviewTrendKeepsSevenDayShapeWithZeroDays() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        createRunner("today-user@test.local", "USER", true, LocalDateTime.now());
        createRunner("old-user@test.local", "USER", true, LocalDateTime.now().minusDays(3).withHour(12).withMinute(0));
        Runner deletedUser = createRunner("deleted-user@test.local", "USER", true, LocalDateTime.now());
        deletedUser.setDeleted(true);
        runnerRepository.save(deletedUser);

        createShoe(admin, "Nike", "Pegasus 41", null, false, LocalDateTime.now());
        createShoe(admin, "ASICS", "Superblast", "https://example.com/shoe.png", false, LocalDateTime.now().minusDays(2).withHour(12).withMinute(0));
        Shoe retiredShoe = createShoe(admin, "Adidas", "Adizero", null, false, LocalDateTime.now());
        retiredShoe.setRetired(true);
        shoeRepository.save(retiredShoe);

        mockMvc.perform(get("/api/admin/overview")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis[0].label").value("Active users"))
                .andExpect(jsonPath("$.kpis[0].trend.length()").value(7))
                .andExpect(jsonPath("$.kpis[0].trend[0].label").value(LocalDate.now().minusDays(6).toString()))
                .andExpect(jsonPath("$.kpis[0].trend[0].value").value(0))
                .andExpect(jsonPath("$.kpis[0].trend[3].label").value(LocalDate.now().minusDays(3).toString()))
                .andExpect(jsonPath("$.kpis[0].trend[3].value").value(1))
                .andExpect(jsonPath("$.kpis[0].trend[6].label").value(LocalDate.now().toString()))
                .andExpect(jsonPath("$.kpis[0].trend[6].value").value(2))
                .andExpect(jsonPath("$.kpis[1].label").value("Shoes"))
                .andExpect(jsonPath("$.kpis[1].trend.length()").value(7))
                .andExpect(jsonPath("$.kpis[1].trend[4].value").value(1))
                .andExpect(jsonPath("$.kpis[1].trend[6].value").value(2));
    }

    @Test
    void overviewCountsFailedJobsBeyondTopTen() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        for (int i = 0; i < 12; i++) {
            saveFailedJob(LocalDateTime.now().minusMinutes(i));
        }

        mockMvc.perform(get("/api/admin/overview")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis[6].label").value("Failed sync jobs"))
                .andExpect(jsonPath("$.kpis[6].value").value(12))
                .andExpect(jsonPath("$.recentJobs.length()").value(10));
    }

    @Test
    void overviewReflectsSoftDeletedUserImmediatelyDespiteCache() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner victim = createRunner("victim@test.local", "USER", true);
        createRunner("other@test.local", "USER", true);

        long activeUsersBefore = activeUsersKpiValue(admin);
        assertThat(activeUsersBefore).isEqualTo(3);

        mockMvc.perform(post("/api/admin/users/bulk")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ids", java.util.List.of(victim.getId()),
                                "action", "soft_delete",
                                "dryRun", false
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.affected").value(1));

        // The bulk mutation must invalidate the dashboard cache, so the very
        // next overview read (well inside the 15s TTL) sees the deletion.
        assertThat(activeUsersKpiValue(admin)).isEqualTo(activeUsersBefore - 1);
    }

    // Runs outside the class-level test-managed transaction so the shoe
    // delete endpoint's own @Transactional boundary commits for real; the
    // deferred cache invalidation (afterCompletion) then fires before
    // MockMvc returns, which is exactly what this test asserts.
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void queuesEndpointServesIdenticalCachedPayloadAndReflectsShoeDeleteImmediately() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner owner = createRunner("runner@test.local", "USER", true);
        Shoe unverified = createShoe(owner, "ASICS", "Superblast", "https://example.com/shoe.png", false);

        String first = mockMvc.perform(get("/api/admin/queues")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unverifiedShoePhotos.length()").value(1))
                .andExpect(jsonPath("$.unverifiedShoePhotos[0].id").value(unverified.getId()))
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Second read inside the TTL is served from the cache and must
        // serialize to byte-identical JSON.
        String second = mockMvc.perform(get("/api/admin/queues")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(second).isEqualTo(first);

        mockMvc.perform(delete("/api/admin/shoes/{id}", unverified.getId())
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        // The shoe delete invalidates the cache, so the queue empties at once.
        mockMvc.perform(get("/api/admin/queues")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unverifiedShoePhotos.length()").value(0));
    }

    private long activeUsersKpiValue(Runner admin) throws Exception {
        String body = mockMvc.perform(get("/api/admin/overview")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis[0].label").value("Active users"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).get("kpis").get(0).get("value").asLong();
    }

    @Test
    void invalidateDashboardCacheAfterCommitDefersInsideActiveTransaction() throws Exception {
        createRunner("admin@test.local", "ADMIN", true);

        // Inside the test-managed transaction the helper must only register a
        // synchronization for afterCompletion, leaving the caches untouched.
        assertThat(TransactionSynchronizationManager.isSynchronizationActive()).isTrue();
        int synchronizationsBefore = TransactionSynchronizationManager.getSynchronizations().size();
        adminPortalService.invalidateDashboardCacheAfterCommit();
        assertThat(TransactionSynchronizationManager.getSynchronizations())
                .hasSize(synchronizationsBefore + 1);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void invalidateDashboardCacheAfterCommitInvalidatesImmediatelyWithoutTransaction() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN", true);
        Runner owner = createRunner("runner@test.local", "USER", true);
        Shoe unverified = createShoe(owner, "ASICS", "Superblast", "https://example.com/shoe.png", false);

        mockMvc.perform(get("/api/admin/queues")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unverifiedShoePhotos.length()").value(1));

        // Repository calls commit on their own here (no test-managed
        // transaction), so the helper must invalidate straight away.
        shoeRepository.delete(unverified);
        assertThat(TransactionSynchronizationManager.isSynchronizationActive()).isFalse();
        adminPortalService.invalidateDashboardCacheAfterCommit();

        mockMvc.perform(get("/api/admin/queues")
                        .header("Authorization", bearer(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unverifiedShoePhotos.length()").value(0));
    }

    private void saveFailedJob(LocalDateTime createdAt) {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("STRAVA_GLOBAL_SYNC");
        job.setStatus(AdminBackgroundJob.STATUS_FAILED);
        job.setCreatedAt(createdAt);
        job.setSummary("Failed job for overview count test.");
        adminBackgroundJobRepository.saveAndFlush(job);
    }

    private AdminAuditLog saveAuditEntry(Runner actor, String action, String targetType, String targetId) {
        AdminAuditLog entry = new AdminAuditLog();
        entry.setActorRunnerId(actor.getId());
        entry.setActorEmail(actor.getEmail());
        entry.setActorRole(actor.getRole());
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setSummary("Audit history test.");
        return adminAuditLogRepository.saveAndFlush(entry);
    }

    private AdminBackgroundJob saveJob(String status) {
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("STRAVA_GLOBAL_SYNC");
        job.setStatus(status);
        job.setCreatedAt(LocalDateTime.now());
        job.setSummary("Job history test.");
        return adminBackgroundJobRepository.saveAndFlush(job);
    }

    private Runner createRunner(String email, String role, boolean emailVerified) {
        return createRunner(email, role, emailVerified, LocalDateTime.now());
    }

    private Runner createRunner(String email, String role, boolean emailVerified, LocalDateTime createdAt) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(emailVerified);
        runner.setCreatedAt(createdAt);
        authService.storePassword(runner, "Password1!");
        return runnerRepository.save(runner);
    }

    private Shoe createShoe(Runner runner, String brand, String model, String photoUrl, boolean verified) {
        return createShoe(runner, brand, model, photoUrl, verified, LocalDateTime.now());
    }

    private Shoe createShoe(Runner runner, String brand, String model, String photoUrl, boolean verified, LocalDateTime createdAt) {
        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setPhotoUrl(photoUrl);
        shoe.setPhotoVerified(verified);
        shoe.setRetired(false);
        shoe.setCreatedAt(createdAt);
        return shoeRepository.save(shoe);
    }

    private String bearer(Runner runner) {
        String token = authService.isAdmin(runner)
                ? authService.issueMfaVerifiedAdminSessionToken(runner, "PASSKEY")
                : authService.issueSessionToken(runner);
        return "Bearer " + token;
    }
}
