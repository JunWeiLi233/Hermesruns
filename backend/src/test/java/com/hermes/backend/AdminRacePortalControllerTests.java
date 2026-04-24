package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminRacePortalControllerTests {
    private AdminPortalService adminPortalService;
    private RaceCourseMapService raceCourseMapService;
    private AdminAuditService adminAuditService;
    private AdminBackgroundJobService adminBackgroundJobService;
    private AdminRacePortalController controller;

    @BeforeEach
    void setUp() {
        adminPortalService = Mockito.mock(AdminPortalService.class);
        raceCourseMapService = Mockito.mock(RaceCourseMapService.class);
        adminAuditService = Mockito.mock(AdminAuditService.class);
        adminBackgroundJobService = Mockito.mock(AdminBackgroundJobService.class);
        controller = new AdminRacePortalController(adminPortalService, adminBackgroundJobService);

        when(adminPortalService.getRaceCourseMapService()).thenReturn(raceCourseMapService);
        when(adminPortalService.getAdminAuditService()).thenReturn(adminAuditService);
    }

    @Test
    @SuppressWarnings("unchecked")
    void uploadRaceCourseMapQueuesAsyncJobAndCompletesEvenWhenAuditLoggingFails() {
        Runner admin = new Runner();
        admin.setId(9L);
        admin.setEmail("admin@test.local");
        admin.setRole("ADMIN");
        when(adminPortalService.requireAdmin("Bearer token")).thenReturn(Optional.of(admin));
        AdminBackgroundJob job = new AdminBackgroundJob();
        job.setJobType("COURSE_MAP_PREVIEW_UPLOAD");
        job.setSummary("Queued course-map preview upload.");
        java.lang.reflect.Field idField;
        try {
            idField = AdminBackgroundJob.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(job, 42L);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        when(adminBackgroundJobService.createJob(anyString(), anyString(), any(Runner.class), anyString(), any())).thenReturn(job);
        doAnswer(invocation -> {
            Runnable task = invocation.getArgument(2);
            task.run();
            return null;
        }).when(adminBackgroundJobService).runAsync(any(AdminBackgroundJob.class), Mockito.eq(1), any(Runnable.class));

        RaceCourseMapResult result = new RaceCourseMapResult(
                "data:image/png;base64,preview",
                "admin-upload",
                false,
                0,
                "Hermes saved the upload but could not align it confidently yet.",
                null,
                java.util.List.of(),
                java.util.List.of(),
                null,
                false
        );
        when(raceCourseMapService.uploadPendingCourseMap(
                anyString(), anyString(), anyString(), anyString(), anyString(),
                any(), any(), any(), anyString(), anyString()
        )).thenReturn(result);
        doThrow(new IllegalStateException("audit unavailable"))
                .when(adminAuditService)
                .log(any(Runner.class), anyString(), anyString(), anyString(), anyString());

        ResponseEntity<?> response = controller.uploadRaceCourseMap(
                "boston-marathon",
                "Bearer token",
                Map.of(
                        "raceName", "Boston Marathon",
                        "city", "Boston",
                        "country", "United States",
                        "website", "https://www.baa.org/races/boston-marathon",
                        "imageDataUrl", "data:image/png;base64,AQID"
                )
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("jobId", 42L);
        verify(adminBackgroundJobService).markCompleted(Mockito.eq(job), Mockito.eq(1), Mockito.eq(0), Mockito.eq(result.summary()), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void uploadRaceCourseMapQueuesAsyncJobAndMarksFailureWhenServiceThrows() {
        Runner admin = new Runner();
        admin.setId(9L);
        admin.setEmail("admin@test.local");
        admin.setRole("ADMIN");
        when(adminPortalService.requireAdmin("Bearer token")).thenReturn(Optional.of(admin));
        AdminBackgroundJob job = new AdminBackgroundJob();
        try {
            java.lang.reflect.Field idField = AdminBackgroundJob.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(job, 77L);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        when(adminBackgroundJobService.createJob(anyString(), anyString(), any(Runner.class), anyString(), any())).thenReturn(job);
        doAnswer(invocation -> {
            Runnable task = invocation.getArgument(2);
            task.run();
            return null;
        }).when(adminBackgroundJobService).runAsync(any(AdminBackgroundJob.class), Mockito.eq(1), any(Runnable.class));
        when(raceCourseMapService.uploadPendingCourseMap(
                anyString(), anyString(), anyString(), anyString(), anyString(),
                any(), any(), any(), anyString(), anyString()
        )).thenThrow(new IllegalStateException("storage write failed"));

        ResponseEntity<?> response = controller.uploadRaceCourseMap(
                "boston-marathon",
                "Bearer token",
                Map.of(
                        "raceName", "Boston Marathon",
                        "city", "Boston",
                        "country", "United States",
                        "website", "https://www.baa.org/races/boston-marathon",
                        "imageDataUrl", "data:image/png;base64,AQID"
                )
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsEntry("jobId", 77L);
        verify(adminBackgroundJobService).markCompleted(Mockito.eq(job), Mockito.eq(0), Mockito.eq(1), Mockito.eq("Course-map upload failed: storage write failed"), any());
    }
}
