package com.hermes.backend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WellnessControllerTests {

    private AuthService authService;
    private RunnerRepository runnerRepository;
    private ReadinessService readinessService;
    private WellnessController controller;
    private Runner runner;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        runnerRepository = mock(RunnerRepository.class);
        readinessService = mock(ReadinessService.class);
        controller = new WellnessController(
                mock(AppleHealthImportService.class),
                mock(GoogleHealthImportService.class),
                authService,
                runnerRepository,
                readinessService
        );
        runner = new Runner();
        runner.setId(1L);
        runner.setEmail("runner@example.local");
        when(readinessService.resolveReadinessSnapshot(any(), any(), any(LocalDate.class)))
                .thenReturn(snapshot("AUTO", "AUTO", "AUTO", "AUTO"));
    }

    @Test
    void getSourcePreferencesRejectsMissingRunner() {
        ResponseEntity<?> response = controller.getSourcePreferences(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getSourcePreferencesReturnsMetricSourcesForAuthenticatedRunner() {
        runner.setGarminWellnessSyncEnabled(true);
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(readinessService.resolveReadinessSnapshot(any(), any(), any(LocalDate.class)))
                .thenReturn(snapshot("GARMIN", "APPLE_HEALTH", "GOOGLE_HEALTH", "OURA"));

        ResponseEntity<?> response = controller.getSourcePreferences("Bearer token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsKeys("metrics", "availableSources");

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = (Map<String, Object>) body.get("metrics");
        assertThat(metrics).containsKeys("sleep", "hrv", "stress", "body");

        @SuppressWarnings("unchecked")
        Map<String, Object> sleep = (Map<String, Object>) metrics.get("sleep");
        assertThat(sleep).containsEntry("source", "auto");
        assertThat(sleep).containsEntry("mode", "auto");
        assertThat(sleep).containsEntry("resolvedSource", "garmin");

        @SuppressWarnings("unchecked")
        Map<String, Object> bodyMetric = (Map<String, Object>) metrics.get("body");
        assertThat(bodyMetric).containsEntry("resolvedSource", "oura");
    }

    @Test
    void updateSourcePreferencesPersistsPerMetricSources() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(runnerRepository.save(runner)).thenReturn(runner);

        ResponseEntity<?> response = controller.updateSourcePreferences("Bearer token", Map.of(
                "metrics", Map.of(
                        "sleep", Map.of("source", "garmin"),
                        "hrv", Map.of("source", "apple_health"),
                        "stress", Map.of("source", "google_health"),
                        "body", Map.of("source", "oura")
                )
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(runner.getWellnessSleepSource()).isEqualTo("GARMIN");
        assertThat(runner.getWellnessHrvSource()).isEqualTo("APPLE_HEALTH");
        assertThat(runner.getWellnessStressSource()).isEqualTo("GOOGLE_HEALTH");
        assertThat(runner.getWellnessRestingHrSource()).isEqualTo("OURA");
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = (Map<String, Object>) body.get("metrics");
        @SuppressWarnings("unchecked")
        Map<String, Object> hrv = (Map<String, Object>) metrics.get("hrv");
        assertThat(hrv).containsEntry("mode", "preferred");
        verify(runnerRepository).save(runner);
    }

    @Test
    void updateSourcePreferencesClearsMetricWhenAutoIsRequested() {
        runner.setWellnessHrvSource("APPLE_HEALTH");
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));
        when(runnerRepository.save(runner)).thenReturn(runner);

        ResponseEntity<?> response = controller.updateSourcePreferences("Bearer token", Map.of(
                "metrics", Map.of("hrv", Map.of("source", "auto"))
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(runner.getWellnessHrvSource()).isNull();
        verify(runnerRepository).save(runner);
    }

    @Test
    void updateSourcePreferencesRejectsUnsupportedSources() {
        when(authService.findByAuthorizationHeader(anyString())).thenReturn(Optional.of(runner));

        ResponseEntity<?> response = controller.updateSourcePreferences("Bearer token", Map.of(
                "metrics", Map.of("sleep", Map.of("source", "whoop"))
        ));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private ReadinessService.MultiSourceReadinessSnapshot snapshot(
            String sleep,
            String hrv,
            String stress,
            String restingHeartRate
    ) {
        return new ReadinessService.MultiSourceReadinessSnapshot(
                new ReadinessService.ReadinessResult(75, "EASY", 75, 75, 75, 75),
                new ReadinessService.MetricSources(sleep, hrv, restingHeartRate, stress)
        );
    }
}
