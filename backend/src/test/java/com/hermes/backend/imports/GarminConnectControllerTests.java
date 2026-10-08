package com.hermes.backend.imports;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.auth.SecretEncryptionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class GarminConnectControllerTests {

    private AuthService authService;
    private GarminConnectImportService importService;
    private GarminWellnessImportService wellnessService;
    private SecretEncryptionService encryptionService;
    private RunnerRepository runnerRepository;
    private GarminConnectController controller;
    private Runner runner;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        importService = mock(GarminConnectImportService.class);
        wellnessService = mock(GarminWellnessImportService.class);
        encryptionService = mock(SecretEncryptionService.class);
        runnerRepository = mock(RunnerRepository.class);
        controller = new GarminConnectController(authService, importService, wellnessService, encryptionService, runnerRepository);
        runner = new Runner();
        runner.setId(1L);
        runner.setEmail("test@example.local");
    }

    @Test
    void startImportRejectsMissingAuthorization() {
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ResponseEntity<?> response = controller.startImport(null, Map.of());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void startImportRejectsUnexpectedFields() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        ResponseEntity<?> response = controller.startImport("Bearer token", Map.of("unknown", "value"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void startImportRejectsOutOfRangeLimit() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        ResponseEntity<?> response = controller.startImport("Bearer token", Map.of(
                "garminEmail", "test@test.com",
                "garminPassword", "pass",
                "limit", 250
        ));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void startImportReturnsConflictWhenImportAlreadyRunning() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(importService.startImport(runner, "test@test.com", "pass", 50)).thenReturn(false);
        ResponseEntity<?> response = controller.startImport("Bearer token", Map.of(
                "garminEmail", "test@test.com",
                "garminPassword", "pass"
        ));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void startImportReturnsTooManyRequestsDuringGarminRateLimitCooldown() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(importService.getRateLimitRetryAfterSeconds(runner.getId())).thenReturn(900L);

        ResponseEntity<?> response = controller.startImport("Bearer token", Map.of(
                "garminEmail", "test@test.com",
                "garminPassword", "pass"
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("900");
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("error")).asString().contains("temporarily rate limiting");
        assertThat(body.get("retryAfterSeconds")).isEqualTo(900L);
        verify(importService, never()).startImport(any(), anyString(), anyString(), anyInt());
    }

    @Test
    void startImportReturnsStartedPayloadForValidRequest() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(importService.startImport(any(), any(), any(), anyInt())).thenReturn(true);

        ResponseEntity<?> response = controller.startImport("Bearer token", Map.of(
                "garminEmail", "test@test.com",
                "garminPassword", "pass"
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
    }

    @Test
    void getImportStatusRejectsMissingAuthorization() {
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ResponseEntity<?> response = controller.getImportStatus(null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getImportStatusReturnsTrackedStatusForAuthenticatedRunner() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(importService.getStatus(runner.getId())).thenReturn(new GarminConnectImportService.GarminSyncStatus(
                "RUNNING", 5, 2, 0, 0, null, true, 0));

        ResponseEntity<?> response = controller.getImportStatus("Bearer token");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(GarminConnectImportService.GarminSyncStatus.class);
        GarminConnectImportService.GarminSyncStatus body =
                (GarminConnectImportService.GarminSyncStatus) response.getBody();
        assertThat(body.status()).isEqualTo("RUNNING");
        assertThat(body.importedRuns()).isEqualTo(5);
    }

    @Test
    void getWellnessStatusRejectsMissingAuthorization() {
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.getWellnessStatus(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(wellnessService, encryptionService);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void getWellnessStatusReportsStoredCredentialsIndependentlyOfSync(boolean enabled) {
        runner.setGarminConnectEmail("garmin@example.test");
        runner.setGarminConnectPasswordEncrypted("fixture-encrypted-password");
        runner.setGarminWellnessSyncEnabled(enabled);
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        var syncStatus = GarminWellnessImportService.WellnessSyncStatus.idle();
        when(wellnessService.getStatus(runner.getId())).thenReturn(syncStatus);

        ResponseEntity<?> response = controller.getWellnessStatus("Bearer token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("credentialsSaved")).isEqualTo(true);
        assertThat(body.get("wellnessSyncEnabled")).isEqualTo(enabled);
        assertThat(body.get("syncStatus")).isEqualTo(syncStatus);
        assertThat(body.get("lastSyncedAt")).isNull();
        assertThat(body.keySet()).isEqualTo(Set.of("syncStatus", "wellnessSyncEnabled", "credentialsSaved", "lastSyncedAt"));
        assertThat(body.containsValue(runner.getGarminConnectEmail())).isFalse();
        assertThat(body.containsValue(runner.getGarminConnectPasswordEncrypted())).isFalse();
        verifyNoInteractions(encryptionService);
    }

    @ParameterizedTest
    @CsvSource(value = {
            "NULL, NULL",
            "'', fixture-encrypted-password",
            "'   ', fixture-encrypted-password",
            "garmin@example.test, NULL",
            "garmin@example.test, ''",
            "garmin@example.test, '   '"
    }, nullValues = "NULL")
    void getWellnessStatusDoesNotReportMissingOrIncompleteCredentialsAsSaved(String email, String encryptedPassword) {
        runner.setGarminConnectEmail(email);
        runner.setGarminConnectPasswordEncrypted(encryptedPassword);
        runner.setGarminWellnessSyncEnabled(true);
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));

        ResponseEntity<?> response = controller.getWellnessStatus("Bearer token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("credentialsSaved")).isEqualTo(false);
        assertThat(body.get("wellnessSyncEnabled")).isEqualTo(true);
        verifyNoInteractions(encryptionService);
    }

    @Test
    void disablingWellnessSyncRetainsStoredCredentialsForReEnable() {
        runner.setGarminConnectEmail("garmin@example.test");
        runner.setGarminConnectPasswordEncrypted("fixture-encrypted-password");
        runner.setGarminWellnessSyncEnabled(true);
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));

        ResponseEntity<?> disabled = controller.toggleWellnessSync("Bearer token", Map.of("enabled", false));

        assertThat(disabled.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(runner.isGarminWellnessSyncEnabled()).isFalse();
        assertThat(runner.getGarminConnectEmail()).isEqualTo("garmin@example.test");
        assertThat(runner.getGarminConnectPasswordEncrypted()).isEqualTo("fixture-encrypted-password");
        Map<?, ?> status = (Map<?, ?>) controller.getWellnessStatus("Bearer token").getBody();
        assertThat(status.get("credentialsSaved")).isEqualTo(true);
        assertThat(status.get("wellnessSyncEnabled")).isEqualTo(false);

        ResponseEntity<?> enabled = controller.toggleWellnessSync("Bearer token", Map.of("enabled", true));

        assertThat(enabled.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(runner.isGarminWellnessSyncEnabled()).isTrue();
        verifyNoInteractions(encryptionService);
    }

    @ParameterizedTest
    @CsvSource(value = {
            "NULL, NULL",
            "'', fixture-encrypted-password",
            "'   ', fixture-encrypted-password",
            "garmin@example.test, NULL",
            "garmin@example.test, ''",
            "garmin@example.test, '   '"
    }, nullValues = "NULL")
    void cannotEnableWellnessSyncWithoutCompleteStoredCredentials(String email, String encryptedPassword) {
        runner.setGarminConnectEmail(email);
        runner.setGarminConnectPasswordEncrypted(encryptedPassword);
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));

        ResponseEntity<?> response = controller.toggleWellnessSync("Bearer token", Map.of("enabled", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(runner.isGarminWellnessSyncEnabled()).isFalse();
        verifyNoInteractions(runnerRepository, encryptionService);
    }

    @Test
    void startWellnessImportReturnsTooManyRequestsDuringGarminRateLimitCooldown() {
        runner.setGarminConnectEmail("test@test.com");
        runner.setGarminConnectPasswordEncrypted("encrypted");
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(encryptionService.decrypt("encrypted")).thenReturn("pass");
        when(wellnessService.getRateLimitRetryAfterSeconds(runner.getId())).thenReturn(600L);

        ResponseEntity<?> response = controller.startWellnessImport("Bearer token", Map.of("daysBack", 7));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("600");
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("error")).asString().contains("temporarily rate limiting");
        assertThat(body.get("retryAfterSeconds")).isEqualTo(600L);
        verify(wellnessService, never()).startWellnessImport(any(), anyString(), anyString(), anyInt());
    }
}
