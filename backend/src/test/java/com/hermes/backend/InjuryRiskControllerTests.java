package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
        InjuryRiskController controller = new InjuryRiskController(mock(InjuryRiskService.class), authService);

        ResponseEntity<?> response = controller.logSoreness(Map.of("level", "LOW"), request(null));

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void logSorenessRejectsNullBody() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(mock(InjuryRiskService.class), authService);

        ResponseEntity<?> response = controller.logSoreness(null, request("Bearer token"));

        assertError(response, HttpStatus.BAD_REQUEST, "level is required (LOW, MEDIUM, or HIGH).");
    }

    @Test
    void logSorenessRejectsInvalidLevel() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(mock(InjuryRiskService.class), authService);

        ResponseEntity<?> response = controller.logSoreness(
                Map.of("level", "extreme"),
                request("Bearer token"));

        assertError(response, HttpStatus.BAD_REQUEST, "level must be LOW, MEDIUM, or HIGH.");
    }

    @Test
    void logSorenessReturnsResponseForValidInput() {
        AuthService authService = mock(AuthService.class);
        InjuryRiskService injuryRiskService = mock(InjuryRiskService.class);
        Runner runner = runner();
        SorenessLog expected = new SorenessLog(runner, LocalDate.now(), "HIGH", "Hamstring tight");
        expected.setId(1L);
        expected.setCreatedAt(LocalDateTime.now());
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(injuryRiskService.logSoreness(runner, "HIGH", "Hamstring tight")).thenReturn(expected);
        InjuryRiskController controller = new InjuryRiskController(injuryRiskService, authService);

        ResponseEntity<?> response = controller.logSoreness(
                Map.of("level", "high", "notes", "Hamstring tight"),
                request("Bearer token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("id")).isEqualTo(1L);
        assertThat(body.get("level")).isEqualTo("HIGH");
    }

    @Test
    void logSorenessRejectsNotesOver500Chars() {
        AuthService authService = mock(AuthService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        InjuryRiskController controller = new InjuryRiskController(mock(InjuryRiskService.class), authService);

        String longNotes = "x".repeat(501);
        ResponseEntity<?> response = controller.logSoreness(
                Map.of("level", "medium", "notes", longNotes),
                request("Bearer token"));

        assertError(response, HttpStatus.BAD_REQUEST, "notes must be 500 characters or fewer.");
    }

    @Test
    void getStatusRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        InjuryRiskController controller = new InjuryRiskController(mock(InjuryRiskService.class), authService);

        ResponseEntity<?> response = controller.getStatus(request(null));

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    @Test
    void getStatusReturnsStatusForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        InjuryRiskService injuryRiskService = mock(InjuryRiskService.class);
        Runner runner = runner();
        InjuryRiskService.InjuryRiskAssessment status = new InjuryRiskService.InjuryRiskAssessment(
                1.12, "LOW", "LOW", "Keep easy days easy.");
        when(authService.findByAuthorizationHeader("Bearer token")).thenReturn(Optional.of(runner));
        when(injuryRiskService.getRiskAssessment(runner)).thenReturn(status);
        InjuryRiskController controller = new InjuryRiskController(injuryRiskService, authService);

        ResponseEntity<?> response = controller.getStatus(request("Bearer token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(status);
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }

    private MockHttpServletRequest request(String authHeader) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (authHeader != null) {
            request.addHeader("Authorization", authHeader);
        }
        return request;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
