package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StravaWebhookControllerTests {

    private static final String VALID_TOKEN = "hermes-strava-webhook";

    @Test
    void validateSubscriptionRejectsWrongVerifyToken() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(OAuthController.class));

        ResponseEntity<?> response = controller.validateSubscription("subscribe", "wrong-token", "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionRejectsWrongMode() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(OAuthController.class));

        ResponseEntity<?> response = controller.validateSubscription("ping", VALID_TOKEN, "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionReturnsHubChallengeForValidRequest() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(OAuthController.class));

        ResponseEntity<?> response = controller.validateSubscription("subscribe", VALID_TOKEN, "challenge-123");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("hub.challenge", "challenge-123"));
    }

    @Test
    void handleEventRejectsWrongToken() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(OAuthController.class));

        ResponseEntity<String> response = controller.handleEvent("wrong-token", Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void handleEventReturnsReceivedWhenOwnerIdIsMissing() {
        OAuthController oAuthController = mock(OAuthController.class);
        StravaWebhookController controller = createController(mock(RunnerRepository.class), oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "object_id", 99999L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(oAuthController, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventIgnoresNonActivityPayloads() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "segment",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 99999L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(runnerRepository, never()).findByStravaAthleteId(org.mockito.ArgumentMatchers.anyLong());
        verify(oAuthController, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(oAuthController, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventIgnoresMalformedAthleteUpdatesPayload() {
        OAuthController oAuthController = mock(OAuthController.class);
        StravaWebhookController controller = createController(mock(RunnerRepository.class), oAuthController);

        ResponseEntity<String> response = assertDoesNotThrow(() -> controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "athlete",
                "aspect_type", "update",
                "owner_id", 321L,
                "updates", "not-a-map"
        )));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(oAuthController, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventSyncsMatchingRunnerForActivityCreate() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(oAuthController.syncStravaActivityById(runner, 98765L)).thenReturn(OAuthController.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, timeout(1000)).syncStravaActivityById(runner, 98765L);
        verify(oAuthController, never()).deleteStravaActivity(runner, 98765L);
    }

    @Test
    void handleEventSyncsMatchingRunnerForStringIds() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(oAuthController.syncStravaActivityById(runner, 98765L)).thenReturn(OAuthController.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "update",
                "owner_id", "321",
                "object_id", "98765"
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, timeout(1000)).syncStravaActivityById(runner, 98765L);
        verify(oAuthController, never()).deleteStravaActivity(runner, 98765L);
    }

    @Test
    void handleEventDeletesMatchingRunnerActivityForDeleteEvent() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "delete",
                "owner_id", 321L,
                "object_id", 98765L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, timeout(1000)).deleteStravaActivity(runner, 98765L);
        verify(oAuthController, never()).syncStravaActivityById(runner, 98765L);
    }

    @Test
    void handleEventReturnsReceivedWhenRunnerIsMissing() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.empty());
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "update",
                "owner_id", 321L,
                "object_id", 98765L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, never()).syncStravaActivityById(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(oAuthController, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventRetriesWebhookSyncBurstOnRetryableFailures() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        OAuthController oAuthController = mock(OAuthController.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(oAuthController.syncStravaActivityById(runner, 98765L))
                .thenReturn(OAuthController.SingleActivitySyncResult.RETRYABLE_FAILURE)
                .thenReturn(OAuthController.SingleActivitySyncResult.RETRYABLE_FAILURE)
                .thenReturn(OAuthController.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, oAuthController);

        ResponseEntity<String> response = controller.handleEvent(VALID_TOKEN, Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(oAuthController, timeout(9000).times(3)).syncStravaActivityById(runner, 98765L);
        verify(oAuthController, never()).deleteStravaActivity(runner, 98765L);
    }

    private StravaWebhookController createController(RunnerRepository runnerRepository, OAuthController oAuthController) {
        StravaWebhookController controller = new StravaWebhookController(runnerRepository, oAuthController);
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
