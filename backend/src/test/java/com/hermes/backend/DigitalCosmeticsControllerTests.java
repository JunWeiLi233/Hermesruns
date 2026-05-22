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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class DigitalCosmeticsControllerTests {

    @Test
    void inventoryRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.inventory(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid Session");
        verifyNoInteractions(digitalCosmeticsService);
    }

    @Test
    void inventoryRejectsMalformedAuthorizationToken() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        when(authService.findByAuthorizationHeader("Bearer bad-token")).thenReturn(Optional.empty());
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.inventory("Bearer bad-token");

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid Session");
        verifyNoInteractions(digitalCosmeticsService);
    }

    @Test
    void inventoryReturnsWrappedInventoryForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        Runner runner = runner();
        List<DigitalCosmeticsService.DigitalCosmeticClientPayload> inventory = List.of(
                new DigitalCosmeticsService.DigitalCosmeticClientPayload(
                        11L,
                        "MIL_SPEC",
                        "10K Proof of Work",
                        0.12,
                        "Minimal Wear",
                        "{\"wear\":0.12}",
                        Map.of("wear", 0.12),
                        LocalDateTime.of(2026, 4, 14, 9, 30)));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(digitalCosmeticsService.listInventory(runner)).thenReturn(inventory);
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.inventory("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("items", inventory));
        verify(digitalCosmeticsService).listInventory(runner);
    }

    @Test
    void activeThemeRejectsMissingAuthorization() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.activeTheme(null);

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid Session");
        verifyNoInteractions(digitalCosmeticsService);
    }

    @Test
    void activeThemeRejectsMalformedAuthorizationToken() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        when(authService.findByAuthorizationHeader("Bearer bad-token")).thenReturn(Optional.empty());
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.activeTheme("Bearer bad-token");

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid Session");
        verifyNoInteractions(digitalCosmeticsService);
    }

    @Test
    void activeThemeReturnsWrappedPayloadForAuthenticatedRunner() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        Runner runner = runner();
        DigitalCosmeticsService.ActiveThemePayload payload = new DigitalCosmeticsService.ActiveThemePayload(
                22L,
                "COVERT",
                "Factory New",
                0.04,
                Map.of("wear", 0.04, "theme", Map.of("primary", "#b91c1c")),
                LocalDateTime.of(2026, 4, 14, 7, 45));
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(digitalCosmeticsService.getActiveTheme(runner)).thenReturn(payload);
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.activeTheme("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(Map.of("activeTheme", payload));
        verify(digitalCosmeticsService).getActiveTheme(runner);
    }

    @Test
    @SuppressWarnings("unchecked")
    void activeThemeAllowsNullPayloadForNewRunner() {
        AuthService authService = mock(AuthService.class);
        DigitalCosmeticsService digitalCosmeticsService = mock(DigitalCosmeticsService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(digitalCosmeticsService.getActiveTheme(runner)).thenReturn(null);
        DigitalCosmeticsController controller = new DigitalCosmeticsController(authService, digitalCosmeticsService);

        ResponseEntity<?> response = controller.activeTheme("Bearer runner-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsKey("activeTheme");
        assertThat(body.get("activeTheme")).isNull();
        verify(digitalCosmeticsService).getActiveTheme(runner);
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
