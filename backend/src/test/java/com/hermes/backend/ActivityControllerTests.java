package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActivityControllerTests {

    @Test
    void getUserRunsReturnsDtoFeedItemsWithNormalizedMetricsAndShoeMetadata() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService,
                activityRepository,
                activityPointRepository,
                runnerRepository,
                secretEncryptionService,
                elevationCorrectionService,
                restTemplate
        );

        Runner runner = new Runner();
        runner.setId(77L);
        runner.setEmail("runner@hermes.test");

        when(authService.findByAuthorizationHeader("Bearer session-token")).thenReturn(Optional.of(runner));
        when(activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN)).thenReturn(List.of());

        ResponseEntity<?> response = controller.getUserRuns("Bearer session-token");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertInstanceOf(List.class, response.getBody());
        List<?> body = (List<?>) response.getBody();
        assertEquals(0, body.size());
    }

    @Test
    void getUserRunsReturns401JsonWhenSessionExpired() {
        AuthService authService = mock(AuthService.class);
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        SecretEncryptionService secretEncryptionService = mock(SecretEncryptionService.class);
        ElevationCorrectionService elevationCorrectionService = mock(ElevationCorrectionService.class);
        RestTemplate restTemplate = mock(RestTemplate.class);

        ActivityController controller = new ActivityController(
                authService, activityRepository, activityPointRepository,
                runnerRepository, secretEncryptionService, elevationCorrectionService, restTemplate
        );

        when(authService.findByAuthorizationHeader("Bearer expired")).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getUserRuns("Bearer expired");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        // Must be a JSON body (Map), not a plain string, so the frontend can parse it safely.
        assertInstanceOf(java.util.Map.class, response.getBody());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> body = (java.util.Map<String, String>) response.getBody();
        assertNotNull(body.get("error"));
        assertNotNull(body.get("code"));
    }
}
