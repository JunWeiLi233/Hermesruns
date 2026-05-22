package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StravaWebhookControllerTests {

    private static final String VALID_TOKEN = "hermes-strava-webhook";

    @Test
    void validateSubscriptionRejectsWrongVerifyToken() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<?> response = controller.validateSubscription("subscribe", "wrong-token", "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionRejectsWrongMode() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<?> response = controller.validateSubscription("ping", VALID_TOKEN, "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionReturnsHubChallengeForValidRequest() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<?> response = controller.validateSubscription("subscribe", VALID_TOKEN, "challenge-123");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("hub.challenge", "challenge-123"));
    }

    @Test
    void handleEventRejectsMissingRequiredFields() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<String> response = controller.handleEvent(event("object_type", "activity"), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isEqualTo("MISSING_REQUIRED_FIELDS");
    }

    @Test
    void handleEventRejectsMissingObjectType() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "aspect_type", "create",
                "owner_id", 321L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isEqualTo("MISSING_REQUIRED_FIELDS");
    }

    @Test
    void handleEventReturnsReceivedWhenObjectIdIsNullForActivity() {
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        StravaWebhookController controller = createController(mock(RunnerRepository.class), stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventIgnoresNonActivityPayloads() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "segment",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 99999L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(runnerRepository, never()).findByStravaAthleteId(org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventIgnoresMalformedAthleteUpdatesPayload() {
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        StravaWebhookController controller = createController(mock(RunnerRepository.class), stravaSyncService);

        ResponseEntity<String> response = assertDoesNotThrow(() -> controller.handleEvent(event(Map.of(
                "object_type", "athlete",
                "aspect_type", "update",
                "owner_id", 321L,
                "updates", "not-a-map"
        )), null));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventSyncsMatchingRunnerForActivityCreate() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(stravaSyncService.syncStravaActivityById(runner, 98765L)).thenReturn(StravaSyncService.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(1000)).syncStravaActivityById(runner, 98765L);
        verify(stravaSyncService, never()).deleteStravaActivity(runner, 98765L);
    }

    @Test
    void handleEventSyncsMatchingRunnerForStringIds() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(stravaSyncService.syncStravaActivityById(runner, 98765L)).thenReturn(StravaSyncService.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "update",
                "owner_id", "321",
                "object_id", "98765"
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(1000)).syncStravaActivityById(runner, 98765L);
        verify(stravaSyncService, never()).deleteStravaActivity(runner, 98765L);
    }

    @Test
    void handleEventDeletesMatchingRunnerActivityForDeleteEvent() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "delete",
                "owner_id", 321L,
                "object_id", 98765L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(1000)).deleteStravaActivity(runner, 98765L);
        verify(stravaSyncService, never()).syncStravaActivityById(runner, 98765L);
    }

    @Test
    void handleEventRejectsActivityWhenRunnerIsMissing() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.empty());
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "update",
                "owner_id", 321L,
                "object_id", 98765L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isEqualTo("UNKNOWN_OWNER");
        verify(stravaSyncService, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventRetriesWebhookSyncBurstOnRetryableFailures() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(stravaSyncService.syncStravaActivityById(runner, 98765L))
                .thenReturn(StravaSyncService.SingleActivitySyncResult.RETRYABLE_FAILURE)
                .thenReturn(StravaSyncService.SingleActivitySyncResult.RETRYABLE_FAILURE)
                .thenReturn(StravaSyncService.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        )), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(9000).times(3)).syncStravaActivityById(runner, 98765L);
        verify(stravaSyncService, never()).deleteStravaActivity(runner, 98765L);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> event(Map<String, ?> source) {
        return new HashMap<>(source);
    }

    private static Map<String, Object> event(String key, Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put(key, value);
        return map;
    }

    private StravaWebhookController createController(RunnerRepository runnerRepository, StravaSyncService stravaSyncService) {
        StravaWebhookController controller = new StravaWebhookController(runnerRepository, stravaSyncService);
        ReflectionTestUtils.setField(controller, "verifyToken", VALID_TOKEN);
        return controller;
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(42L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
