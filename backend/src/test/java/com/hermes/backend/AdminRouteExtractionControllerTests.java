package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
}
