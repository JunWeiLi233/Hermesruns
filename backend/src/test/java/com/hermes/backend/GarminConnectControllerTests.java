package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GarminConnectControllerTests {

    @Test
    void startImportRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        GarminConnectController controller = new GarminConnectController(authService, mock(GarminConnectImportService.class));

        ResponseEntity<?> response = controller.startImport(null, validBody());

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void startImportRejectsUnexpectedFields() {
        AuthService authService = mock(AuthService.class);
        GarminConnectImportService importService = mock(GarminConnectImportService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        GarminConnectController controller = new GarminConnectController(authService, importService);

        Map<String, Object> body = new LinkedHashMap<>(validBody());
        body.put("unexpected", "boom");

        ResponseEntity<?> response = controller.startImport("Bearer runner-token", body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> payload = (Map<String, String>) response.getBody();
        assertThat(payload.get("error")).contains("unexpected");
    }

    @Test
    void startImportRejectsOutOfRangeLimit() {
        AuthService authService = mock(AuthService.class);
        GarminConnectImportService importService = mock(GarminConnectImportService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        GarminConnectController controller = new GarminConnectController(authService, importService);

        Map<String, Object> body = new LinkedHashMap<>(validBody());
        body.put("limit", 0);

        ResponseEntity<?> response = controller.startImport("Bearer runner-token", body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> payload = (Map<String, String>) response.getBody();
        assertThat(payload.get("error")).contains("limit");
    }

    @Test
    void startImportReturnsConflictWhenImportAlreadyRunning() {
        AuthService authService = mock(AuthService.class);
        GarminConnectImportService importService = mock(GarminConnectImportService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(importService.startImport(runner, "runner@garmin.test", "secret-pass", 25)).thenReturn(false);
        GarminConnectController controller = new GarminConnectController(authService, importService);

        Map<String, Object> body = new LinkedHashMap<>(validBody());
        body.put("limit", 25);

        ResponseEntity<?> response = controller.startImport("Bearer runner-token", body);

        assertError(response, HttpStatus.CONFLICT, "A Garmin Connect import is already in progress.");
    }

    @Test
    void startImportReturnsStartedPayloadForValidRequest() {
        AuthService authService = mock(AuthService.class);
        GarminConnectImportService importService = mock(GarminConnectImportService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(importService.startImport(runner, "runner@garmin.test", "secret-pass", 25)).thenReturn(true);
        GarminConnectController controller = new GarminConnectController(authService, importService);

        Map<String, Object> body = new LinkedHashMap<>(validBody());
        body.put("limit", 25);

        ResponseEntity<?> response = controller.startImport("Bearer runner-token", body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getBody();
        assertThat(payload).containsEntry("status", "STARTED");
        assertThat(payload.get("message")).isEqualTo("Garmin Connect import started. Poll /api/garmin/connect/import/status for progress.");
        verify(importService).startImport(runner, "runner@garmin.test", "secret-pass", 25);
    }

    @Test
    void getImportStatusRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        GarminConnectController controller = new GarminConnectController(authService, mock(GarminConnectImportService.class));

        ResponseEntity<?> response = controller.getImportStatus(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void getImportStatusReturnsTrackedStatusForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        GarminConnectImportService importService = mock(GarminConnectImportService.class);
        Runner runner = runner();
        GarminConnectImportService.GarminSyncStatus status =
                new GarminConnectImportService.GarminSyncStatus("RUNNING", 3, 120, 1, 2, "Syncing latest runs", true);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(importService.getStatus(9L)).thenReturn(status);
        GarminConnectController controller = new GarminConnectController(authService, importService);

        ResponseEntity<?> response = controller.getImportStatus("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(status);
    }

    private Map<String, Object> validBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("garminEmail", "runner@garmin.test");
        body.put("garminPassword", "secret-pass");
        return body;
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(9L);
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
