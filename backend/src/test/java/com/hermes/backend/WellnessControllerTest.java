package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WellnessControllerTest {

    private AppleHealthImportService appleHealthImportService;
    private GoogleHealthImportService googleHealthImportService;
    private AuthService authService;
    private ReadinessService readinessService;
    private WellnessController controller;

    @BeforeEach
    void setUp() {
        appleHealthImportService = mock(AppleHealthImportService.class);
        googleHealthImportService = mock(GoogleHealthImportService.class);
        authService = mock(AuthService.class);
        readinessService = mock(ReadinessService.class);
        controller = new WellnessController(
                appleHealthImportService,
                googleHealthImportService,
                authService,
                mock(RunnerRepository.class)
        );
    }

    @Test
    void importAppleHealthReturns401WhenRunnerIsNull() {
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        ResponseEntity<?> response = controller.importAppleHealth(null, data);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void importAppleHealthReturns202WhenImportStarts() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(appleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(true);

        ResponseEntity<?> response = controller.importAppleHealth(runner, data);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertThat(body).containsEntry("message", "Apple Health import started.");
    }

    @Test
    void importAppleHealthReturns429WhenImportAlreadyInProgress() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(appleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(false);

        ResponseEntity<?> response = controller.importAppleHealth(runner, data);

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertThat(body).containsEntry("message", "Import already in progress.");
    }

    @Test
    void getAppleHealthStatusReturns200WithStatus() {
        Runner runner = runner(1L);
        AppleHealthImportService.HealthSyncStatus status =
                new AppleHealthImportService.HealthSyncStatus(false, 3, "Completed", false);
        when(appleHealthImportService.getStatus(1L)).thenReturn(status);

        ResponseEntity<?> response = controller.getAppleHealthStatus(runner);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(status);
    }

    @Test
    void getAppleHealthStatusReturns401WhenRunnerIsNull() {
        ResponseEntity<?> response = controller.getAppleHealthStatus(null);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void importGoogleHealthReturns401WhenRunnerIsNull() {
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        ResponseEntity<?> response = controller.importGoogleHealth(null, data);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void importGoogleHealthReturns202WhenImportStarts() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(googleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(true);

        ResponseEntity<?> response = controller.importGoogleHealth(runner, data);

        assertThat(response.getStatusCode().value()).isEqualTo(202);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertThat(body).containsEntry("message", "Google Health Connect import started.");
    }

    @Test
    void importGoogleHealthReturns429WhenImportAlreadyInProgress() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(googleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(false);

        ResponseEntity<?> response = controller.importGoogleHealth(runner, data);

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) response.getBody();
        assertThat(body).containsEntry("message", "Import already in progress.");
    }

    @Test
    void getGoogleHealthStatusReturns200WithStatus() {
        Runner runner = runner(1L);
        GoogleHealthImportService.HealthSyncStatus status =
                new GoogleHealthImportService.HealthSyncStatus(false, 2, "Completed", false);
        when(googleHealthImportService.getStatus(1L)).thenReturn(status);

        ResponseEntity<?> response = controller.getGoogleHealthStatus(runner);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(status);
    }

    @Test
    void getGoogleHealthStatusReturns401WhenRunnerIsNull() {
        ResponseEntity<?> response = controller.getGoogleHealthStatus(null);
        assertThat(response.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void importAppleHealthDelegatesToService() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(appleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(true);

        controller.importAppleHealth(runner, data);

        verify(appleHealthImportService).importWellnessData(runner, data);
    }

    @Test
    void importGoogleHealthDelegatesToService() {
        Runner runner = runner(1L);
        List<Map<String, Object>> data = List.of(Map.of("type", "wellness", "date", "2026-04-20"));
        when(googleHealthImportService.importWellnessData(eq(runner), any())).thenReturn(true);

        controller.importGoogleHealth(runner, data);

        verify(googleHealthImportService).importWellnessData(runner, data);
    }

    @Test
    void appleHealthStatusDelegatesWithCorrectRunnerId() {
        Runner runner = runner(42L);
        when(appleHealthImportService.getStatus(42L))
                .thenReturn(AppleHealthImportService.HealthSyncStatus.idle());

        controller.getAppleHealthStatus(runner);

        verify(appleHealthImportService).getStatus(42L);
    }

    @Test
    void googleHealthStatusDelegatesWithCorrectRunnerId() {
        Runner runner = runner(42L);
        when(googleHealthImportService.getStatus(42L))
                .thenReturn(GoogleHealthImportService.HealthSyncStatus.idle());

        controller.getGoogleHealthStatus(runner);

        verify(googleHealthImportService).getStatus(42L);
    }

    private Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}
