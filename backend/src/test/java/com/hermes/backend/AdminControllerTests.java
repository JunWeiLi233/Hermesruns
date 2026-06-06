package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class AdminControllerTests {

    private MockMvc mockMvc;
    private AuthService authService;
    private RunnerRepository runnerRepository;
    private ActivityRepository activityRepository;
    private StravaAutoSyncScheduler stravaAutoSyncScheduler;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        runnerRepository = mock(RunnerRepository.class);
        activityRepository = mock(ActivityRepository.class);
        stravaAutoSyncScheduler = mock(StravaAutoSyncScheduler.class);

        mockMvc = MockMvcBuilders.standaloneSetup(new AdminController(
                authService,
                runnerRepository,
                activityRepository,
                stravaAutoSyncScheduler))
                .build();
    }

    @Test
    void statsEndpointRejectsMissingAuthorization() throws Exception {
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Admin privileges required."));
    }

    @Test
    void statsEndpointReturnsCountsAndRuntimeFieldsForAdmin() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN");
        String authorization = bearer("admin-token");
        when(authService.findByAuthorizationHeader(authorization)).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(runnerRepository.count()).thenReturn(2L);
        when(activityRepository.count()).thenReturn(1L);

        mockMvc.perform(get("/api/admin/stats")
                        .header("Authorization", authorization))
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
        String authorization = bearer("user-token");
        when(authService.findByAuthorizationHeader(authorization)).thenReturn(Optional.of(user));
        when(authService.isAdmin(user)).thenReturn(false);

        mockMvc.perform(post("/api/admin/sync-all")
                        .header("Authorization", authorization))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Admin privileges required."));
    }

    @Test
    void syncAllEndpointUsesLegacyTriggerSourceForAdmin() throws Exception {
        Runner admin = createRunner("admin@test.local", "ADMIN");
        String authorization = bearer("admin-token");
        AdminBackgroundJob job = new AdminBackgroundJob();
        ReflectionTestUtils.setField(job, "id", 42L);
        job.setStatus(AdminBackgroundJob.STATUS_RUNNING);
        job.setTriggerSource("legacy_admin_endpoint");
        job.setCreatedByEmail("admin@test.local");
        when(authService.findByAuthorizationHeader(authorization)).thenReturn(Optional.of(admin));
        when(authService.isAdmin(admin)).thenReturn(true);
        when(stravaAutoSyncScheduler.triggerAdminSync(admin, "legacy_admin_endpoint")).thenReturn(job);

        mockMvc.perform(post("/api/admin/sync-all")
                        .header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Global Strava sync started."))
                .andExpect(jsonPath("$.jobId").value(42))
                .andExpect(jsonPath("$.status").value(AdminBackgroundJob.STATUS_RUNNING));

        verify(stravaAutoSyncScheduler).triggerAdminSync(admin, "legacy_admin_endpoint");
        assertThat(job.getTriggerSource()).isEqualTo("legacy_admin_endpoint");
        assertThat(job.getCreatedByEmail()).isEqualTo("admin@test.local");
    }

    private Runner createRunner(String email, String role) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setRole(role);
        runner.setStatus("ACTIVE");
        runner.setEmailVerified(true);
        return runner;
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
