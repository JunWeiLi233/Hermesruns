package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InjuryRiskControllerTests {

    @Test
    void logSorenessRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        InjuryRiskController controller = new InjuryRiskController(authService, mock(InjuryRiskService.class));

        ResponseEntity<?> response = controller.logSoreness(null, null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void logSorenessRejectsNullBody() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(authService, mock(InjuryRiskService.class));

        ResponseEntity<?> response = controller.logSoreness("Bearer token", null);

        assertError(response, HttpStatus.BAD_REQUEST, "level is required (low, medium, or high).");
    }

    @Test
    void logSorenessRejectsInvalidLevel() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(authService, mock(InjuryRiskService.class));

        ResponseEntity<?> response = controller.logSoreness("Bearer token",
                new InjuryRiskController.SorenessLogRequest("extreme", null));

        assertError(response, HttpStatus.BAD_REQUEST, "level must be one of: low, medium, high.");
    }

    @Test
    void logSorenessReturnsResponseForValidInput() {
        AuthService authService = mock(AuthService.class);
        InjuryRiskService injuryRiskService = mock(InjuryRiskService.class);
        Runner runner = runner();
        LocalDateTime now = LocalDateTime.now();
        InjuryRiskService.InjuryLogResponse expected = new InjuryRiskService.InjuryLogResponse(
                1L, "high", now, 55, 1.18, "Your training load is elevated and you reported high soreness. Cut volume by 20% today and prioritize sleep.");
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(injuryRiskService.logSoreness(runner, "high", "Hamstring tight")).thenReturn(expected);
        InjuryRiskController controller = new InjuryRiskController(authService, injuryRiskService);

        ResponseEntity<?> response = controller.logSoreness("Bearer token",
                new InjuryRiskController.SorenessLogRequest("high", "Hamstring tight"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(expected);
    }

    @Test
    void logSorenessRejectsNotesOver500Chars() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(authService, mock(InjuryRiskService.class));

        String longNotes = "x".repeat(501);
        ResponseEntity<?> response = controller.logSoreness("Bearer token",
                new InjuryRiskController.SorenessLogRequest("medium", longNotes));

        assertError(response, HttpStatus.BAD_REQUEST, "notes must be 500 characters or fewer.");
    }

    @Test
    void getStatusRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        InjuryRiskController controller = new InjuryRiskController(authService, mock(InjuryRiskService.class));

        ResponseEntity<?> response = controller.getStatus(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void getStatusReturnsStatusForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        InjuryRiskService injuryRiskService = mock(InjuryRiskService.class);
        Runner runner = runner();
        InjuryRiskService.InjuryStatusResponse status = new InjuryRiskService.InjuryStatusResponse(
                65, 1.12, "rising", List.of(),
                "ACWR is in the safe zone but trending up. Keep easy days easy.",
                "ready");
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(injuryRiskService.getStatus(runner)).thenReturn(status);
        InjuryRiskController controller = new InjuryRiskController(authService, injuryRiskService);

        ResponseEntity<?> response = controller.getStatus("Bearer token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(status);
    }

    // --- helpers ---

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
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
