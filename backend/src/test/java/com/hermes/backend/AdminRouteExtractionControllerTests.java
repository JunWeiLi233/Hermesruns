package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

        // PENDING/RUNNING jobs are never pruned, even while the map is under pressure.
        for (String jobId : jobIds) {
            assertEquals(HttpStatus.OK, controller.getJobStatus("Bearer token", jobId).getStatusCode());
        }

        blockPipeline.countDown();
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

        // Wait until every job reached a terminal state and pruning brought the map back under the cap.
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

    private static MarathonRoutePipelineRequest validRequest() {
        return new MarathonRoutePipelineRequest("r-1", "Name", "City", "Country", "Web", 42.2, "Path");
    }
}
