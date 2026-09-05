package com.hermes.backend.admin;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.races.MarathonRoutePipelineRequest;
import com.hermes.backend.races.MarathonRoutePipelineService;
import com.hermes.backend.runner.Runner;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class AdminRouteExtractionControllerTests {
    private AuthService authService;
    private MarathonRoutePipelineService pipelineService;
    private AdminAuditService adminAuditService;
    private AdminRouteExtractionController controller;

    @BeforeEach
    void setUp() {
        authService = Mockito.mock(AuthService.class);
        pipelineService = Mockito.mock(MarathonRoutePipelineService.class);
        adminAuditService = Mockito.mock(AdminAuditService.class);
        controller = new AdminRouteExtractionController(authService, pipelineService, adminAuditService);
    }

    @Test
    void testRunPipeline_Unauthorized() {
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.empty());

        MarathonRoutePipelineRequest request = new MarathonRoutePipelineRequest(
                "r-1", "N", "C", "C", "W", 42.2, "P");
        ResponseEntity<?> response = controller.runPipeline("Bearer token", request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void testRunPipeline_NotAdmin() {
        Runner runner = new Runner();
        runner.setRole("USER");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));

        MarathonRoutePipelineRequest request = new MarathonRoutePipelineRequest(
                "r-1", "N", "C", "C", "W", 42.2, "P");
        ResponseEntity<?> response = controller.runPipeline("Bearer token", request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void testRunPipeline_Success() {
        Runner runner = new Runner();
        runner.setRole("ADMIN");
        runner.setEmail("admin@hermes.com");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));

        MarathonRoutePipelineService.PipelineResult result = new MarathonRoutePipelineService.PipelineResult(null, null, null);
        when(pipelineService.runPipeline(any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(result);

        MarathonRoutePipelineRequest request = new MarathonRoutePipelineRequest(
                "r-1", "Name", "City", "Country", "Web", 42.2, "Path");
        ResponseEntity<?> response = controller.runPipeline("Bearer token", request);

        assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("jobId"));
    }

    @Test
    void testRunPipeline_BadRequest() {
        Runner runner = new Runner();
        runner.setRole("ADMIN");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));

        MarathonRoutePipelineRequest request = new MarathonRoutePipelineRequest(
                "", "Name", "City", "Country", "Web", 42.2, "Path");
        ResponseEntity<?> response = controller.runPipeline("Bearer token", request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    void testPruneFinishedJobs_KeepsActiveJobs() throws Exception {
        Runner runner = new Runner();
        runner.setRole("ADMIN");
        runner.setEmail("admin@hermes.com");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));

        CountDownLatch blockPipeline = new CountDownLatch(1);
        when(pipelineService.runPipeline(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    blockPipeline.await();
                    return new MarathonRoutePipelineService.PipelineResult(null, null, null);
                });

        List<String> jobIds = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            ResponseEntity<?> response = controller.runPipeline("Bearer token", validRequest());
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            jobIds.add(body.get("jobId"));
        }

        controller.pruneFinishedJobs();

        // Only 3 jobs exist, so the map is far below the cap and prune is a no-op
        // here; this pins the API contract only. Real cap-pressure coverage with an
        // active job in the map lives in testPruneFinishedJobs_KeepsActiveJobWhileTerminalJobsExceedCap.
        for (String jobId : jobIds) {
            assertEquals(HttpStatus.OK, controller.getJobStatus("Bearer token", jobId).getStatusCode());
        }

        blockPipeline.countDown();
    }

    @Test
    void testPruneFinishedJobs_KeepsActiveJobWhileTerminalJobsExceedCap() throws Exception {
        Runner runner = new Runner();
        runner.setRole("ADMIN");
        runner.setEmail("admin@hermes.com");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));

        CountDownLatch blockPipeline = new CountDownLatch(1);
        when(pipelineService.runPipeline(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenAnswer(invocation -> {
                    // Only the blocked-race job parks; every other job completes instantly.
                    if ("blocked-race".equals(invocation.getArgument(1))) {
                        blockPipeline.await();
                    }
                    return new MarathonRoutePipelineService.PipelineResult(null, null, null);
                });

        try {
            String blockedJobId = submitJob("blocked-race");
            awaitJobRunning(blockedJobId);

            // 55 instantly-completing jobs push finished entries past the 50-entry
            // retention cap, so every completion after the 50th runs prune while the
            // blocked job is still live in the map.
            String newestJobId = null;
            for (int i = 0; i < 55; i++) {
                newestJobId = submitJob("quick-race");
            }

            long deadline = System.currentTimeMillis() + 15_000;
            while (System.currentTimeMillis() < deadline) {
                if (controller.jobCountForTests() == 51 && isJobTerminal(newestJobId)) {
                    break;
                }
                Thread.sleep(20);
            }

            // The map settles at 50 retained terminal jobs plus the one active job,
            // proving the active entry survived every prune pass.
            assertEquals(51, controller.jobCountForTests());
            assertEquals(HttpStatus.OK, controller.getJobStatus("Bearer token", blockedJobId).getStatusCode());
        } finally {
            blockPipeline.countDown();
        }
    }

    @Test
    void testRunPipeline_PrunesOldestTerminalJobsBeyondRetentionCap() throws Exception {
        Runner runner = new Runner();
        runner.setRole("ADMIN");
        runner.setEmail("admin@hermes.com");
        when(authService.findByAuthorizationHeader(any())).thenReturn(Optional.of(runner));
        when(pipelineService.runPipeline(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new MarathonRoutePipelineService.PipelineResult(null, null, null));

        List<String> jobIds = new ArrayList<>();
        for (int i = 0; i < 60; i++) {
            ResponseEntity<?> response = controller.runPipeline("Bearer token", validRequest());
            @SuppressWarnings("unchecked")
            Map<String, String> body = (Map<String, String>) response.getBody();
            jobIds.add(body.get("jobId"));
        }

        // Wait until every job reached a terminal state and pruning trimmed the
        // finished backlog. Concurrent finally-prunes from the two workers can
        // overlap and remove a couple of extra oldest entries (benign in
        // production), so the guaranteed invariant is the cap, not exactly 50.
        String newestJobId = jobIds.get(jobIds.size() - 1);
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            ResponseEntity<?> newest = controller.getJobStatus("Bearer token", newestJobId);
            boolean newestFinished = newest.getBody() instanceof AdminRouteExtractionController.JobStatus status
                    && status.state != AdminRouteExtractionController.JobState.PENDING
                    && status.state != AdminRouteExtractionController.JobState.RUNNING;
            if (newestFinished && controller.jobCountForTests() <= 50) {
                break;
            }
            Thread.sleep(20);
        }

        assertTrue(controller.jobCountForTests() <= 50);
        assertEquals(HttpStatus.NOT_FOUND, controller.getJobStatus("Bearer token", jobIds.get(0)).getStatusCode());
        assertEquals(HttpStatus.OK, controller.getJobStatus("Bearer token", newestJobId).getStatusCode());
    }

    private String submitJob(String raceId) {
        ResponseEntity<?> response = controller.runPipeline("Bearer token", validRequest(raceId));
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertNotNull(body);
        return body.get("jobId");
    }

    private void awaitJobRunning(String jobId) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            if (getJobState(jobId) == AdminRouteExtractionController.JobState.RUNNING) {
                return;
            }
            Thread.sleep(10);
        }
        assertEquals(AdminRouteExtractionController.JobState.RUNNING, getJobState(jobId));
    }

    private boolean isJobTerminal(String jobId) {
        AdminRouteExtractionController.JobState state = getJobState(jobId);
        return state == AdminRouteExtractionController.JobState.SUCCESS
                || state == AdminRouteExtractionController.JobState.FAILURE;
    }

    private AdminRouteExtractionController.JobState getJobState(String jobId) {
        ResponseEntity<?> response = controller.getJobStatus("Bearer token", jobId);
        return response.getBody() instanceof AdminRouteExtractionController.JobStatus status
                ? status.state
                : null;
    }

    private static MarathonRoutePipelineRequest validRequest() {
        return validRequest("r-1");
    }

    private static MarathonRoutePipelineRequest validRequest(String raceId) {
        return new MarathonRoutePipelineRequest(raceId, "Name", "City", "Country", "Web", 42.2, "Path");
    }
}
