package com.hermes.backend.imports;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StravaWebhookControllerTests {

    private static final String VALID_TOKEN = "hermes-strava-webhook";
    private static final ObjectMapper MAPPER = new ObjectMapper();

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
    void validateSubscriptionRejectsBlankVerifyToken() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));
        ReflectionTestUtils.setField(controller, "verifyToken", "");

        ResponseEntity<?> response = controller.validateSubscription("subscribe", "", "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionRejectsDevelopmentDefaultTokenInProduction() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));
        ReflectionTestUtils.setField(controller, "environment", "production");

        ResponseEntity<?> response = controller.validateSubscription("subscribe", VALID_TOKEN, "challenge-123");

        assertError(response, HttpStatus.FORBIDDEN, "Forbidden");
    }

    @Test
    void validateSubscriptionAcceptsConfiguredSecretTokenInProduction() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));
        ReflectionTestUtils.setField(controller, "environment", "production");
        ReflectionTestUtils.setField(controller, "verifyToken", "long-random-production-secret");

        ResponseEntity<?> response = controller.validateSubscription("subscribe", "long-random-production-secret", "challenge-123");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("hub.challenge", "challenge-123"));
    }

    @Test
    void handleEventRejectsMissingRequiredFields() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<String> response = controller.handleEvent(event("object_type", "activity"), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isEqualTo("MISSING_REQUIRED_FIELDS");
    }

    @Test
    void handleEventRejectsMissingObjectType() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "aspect_type", "create",
                "owner_id", 321L
        )), null, null);

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
        )), null, null);

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
        )), null, null);

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
        )), null, null));

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
        )), null, null);

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
        )), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(1000)).syncStravaActivityById(runner, 98765L);
        verify(stravaSyncService, never()).deleteStravaActivity(runner, 98765L);
    }

    @Test
    void handleEventConfirmsWithStravaBeforeDeletingForDeleteEvent() {
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
        )), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(1000)).deleteStravaActivityIfGone(runner, 98765L);
        // The unsigned event alone must never delete: only the confirmed path may.
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
        verify(stravaSyncService, never()).syncStravaActivityById(runner, 98765L);
    }

    private static Map<String, Object> deauthorization(Object athleteId, String authorized) {
        return Map.of(
                "object_type", "athlete",
                "aspect_type", "update",
                "owner_id", athleteId,
                "object_id", athleteId,
                "updates", Map.of("authorized", authorized)
        );
    }

    @Test
    void handleEventConfirmsDeauthorizationWithStravaInsteadOfTrustingIt() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        StravaAccountService accounts = mock(StravaAccountService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService, accounts);

        ResponseEntity<String> response = controller.handleEvent(event(deauthorization(321L, "false")), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(accounts, timeout(1000)).confirmRevocationAndPurge(42L);
        verify(stravaSyncService, never()).deleteStravaActivity(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void handleEventIgnoresDeauthorizationForAnUnknownAthlete() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaAccountService accounts = mock(StravaAccountService.class);
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.empty());
        StravaWebhookController controller = createController(runnerRepository, mock(StravaSyncService.class), accounts);

        ResponseEntity<String> response = controller.handleEvent(event(deauthorization(321L, "false")), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(accounts, after(300).never()).confirmRevocationAndPurge(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void handleEventIgnoresAnAuthorizedUpdate() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaAccountService accounts = mock(StravaAccountService.class);
        StravaWebhookController controller = createController(runnerRepository, mock(StravaSyncService.class), accounts);

        ResponseEntity<String> response = controller.handleEvent(event(deauthorization(321L, "true")), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(accounts, after(300).never()).confirmRevocationAndPurge(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void repeatedDeauthorizationEventsAreCheckedAtMostOncePerMinutePerRunner() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaAccountService accounts = mock(StravaAccountService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        StravaWebhookController controller = createController(runnerRepository, mock(StravaSyncService.class), accounts);

        controller.handleEvent(event(deauthorization(321L, "false")), null, null);
        verify(accounts, timeout(1000).times(1)).confirmRevocationAndPurge(42L);
        controller.handleEvent(event(deauthorization(321L, "false")), null, null);
        controller.handleEvent(event(deauthorization(321L, "false")), null, null);

        verify(accounts, after(400).times(1)).confirmRevocationAndPurge(42L);
    }

    @Test
    void productionAcceptsUnsignedEventsBecauseStravaDoesNotSignThem() {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        StravaSyncService stravaSyncService = mock(StravaSyncService.class);
        Runner runner = runner();
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner));
        when(stravaSyncService.syncStravaActivityById(runner, 98765L)).thenReturn(StravaSyncService.SingleActivitySyncResult.SUCCESS);
        StravaWebhookController controller = createController(runnerRepository, stravaSyncService);
        ReflectionTestUtils.setField(controller, "environment", "production");
        ReflectionTestUtils.setField(controller, "stravaClientSecret", "client-secret");

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        )), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(stravaSyncService, timeout(1000)).syncStravaActivityById(runner, 98765L);
    }

    @Test
    void aSignatureThatIsPresentMustStillBeValid() {
        StravaWebhookController controller = createController(mock(RunnerRepository.class), mock(StravaSyncService.class));
        ReflectionTestUtils.setField(controller, "stravaClientSecret", "client-secret");

        ResponseEntity<String> response = controller.handleEvent(event(Map.of(
                "object_type", "activity",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 98765L
        )), "sha256=deadbeef", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isEqualTo("Invalid signature");
    }

    @Test
    void aValidSignatureIsAccepted() throws Exception {
        RunnerRepository runnerRepository = mock(RunnerRepository.class);
        when(runnerRepository.findByStravaAthleteId(321L)).thenReturn(Optional.of(runner()));
        StravaWebhookController controller = createController(runnerRepository, mock(StravaSyncService.class));
        ReflectionTestUtils.setField(controller, "stravaClientSecret", "client-secret");
        String body = event(Map.of(
                "object_type", "segment",
                "aspect_type", "create",
                "owner_id", 321L,
                "object_id", 1L
        ));
        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec("client-secret".getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "sha256=" + java.util.HexFormat.of().formatHex(mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8)));

        ResponseEntity<String> response = controller.handleEvent(body, signature, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
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
        )), null, null);

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
        )), null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("EVENT_RECEIVED");
        verify(stravaSyncService, timeout(9000).times(3)).syncStravaActivityById(runner, 98765L);
        verify(stravaSyncService, never()).deleteStravaActivity(runner, 98765L);
    }

    private static String event(Map<String, ?> source) {
        try {
            return MAPPER.writeValueAsString(source);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    private static String event(String key, Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put(key, value);
        return event(map);
    }

    private StravaWebhookController createController(RunnerRepository runnerRepository, StravaSyncService stravaSyncService) {
        return createController(runnerRepository, stravaSyncService, mock(StravaAccountService.class));
    }

    private StravaWebhookController createController(RunnerRepository runnerRepository,
                                                     StravaSyncService stravaSyncService,
                                                     StravaAccountService accounts) {
        StravaWebhookController controller = new StravaWebhookController(runnerRepository, stravaSyncService, accounts);
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
