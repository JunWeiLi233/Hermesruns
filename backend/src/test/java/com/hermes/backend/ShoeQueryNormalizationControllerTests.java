package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ShoeQueryNormalizationControllerTests {

    @Test
    void normalizeRejectsMissingSession() {
        AuthService authService = mock(AuthService.class);
        ShoeQueryNormalizationService normalizationService = mock(ShoeQueryNormalizationService.class);
        when(authService.findByAuthorizationHeader(null)).thenReturn(Optional.empty());
        ShoeQueryNormalizationController controller = controller(authService, normalizationService);

        ResponseEntity<?> response = controller.normalize(null, Map.of("rawInput", "Nike Pegasus 41"));

        assertError(response, HttpStatus.UNAUTHORIZED, "Invalid Session");
        verifyNoInteractions(normalizationService);
    }

    @Test
    void normalizeRejectsMissingBody() {
        AuthService authService = mock(AuthService.class);
        ShoeQueryNormalizationService normalizationService = mock(ShoeQueryNormalizationService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ShoeQueryNormalizationController controller = controller(authService, normalizationService);

        ResponseEntity<?> response = controller.normalize("Bearer runner-token", null);

        assertError(response, HttpStatus.BAD_REQUEST, "Request body is required.");
        verifyNoInteractions(normalizationService);
    }

    @Test
    void normalizeRejectsUnexpectedFields() {
        AuthService authService = mock(AuthService.class);
        ShoeQueryNormalizationService normalizationService = mock(ShoeQueryNormalizationService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        ShoeQueryNormalizationController controller = controller(authService, normalizationService);

        ResponseEntity<?> response = controller.normalize(
                "Bearer runner-token",
                Map.of("rawInput", "Nike Pegasus 41", "brand", "Nike")
        );

        assertError(response, HttpStatus.BAD_REQUEST, "Unexpected fields: brand");
        verifyNoInteractions(normalizationService);
    }

    @Test
    void normalizeReturnsServiceUnavailableErrorWhenAiNormalizationIsOffline() {
        AuthService authService = mock(AuthService.class);
        ShoeQueryNormalizationService normalizationService = mock(ShoeQueryNormalizationService.class);
        Runner runner = runner();
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(normalizationService.normalize("Nike Pegasus 41"))
                .thenThrow(new IllegalStateException("AI normalization is not configured."));
        ShoeQueryNormalizationController controller = controller(authService, normalizationService);

        ResponseEntity<?> response = controller.normalize(
                "Bearer runner-token",
                Map.of("rawInput", "Nike Pegasus 41")
        );

        assertError(response, HttpStatus.SERVICE_UNAVAILABLE, "AI normalization is not configured.");
        verify(normalizationService).normalize("Nike Pegasus 41");
    }

    @Test
    void normalizeReturnsNormalizedMetadataPayload() {
        AuthService authService = mock(AuthService.class);
        ShoeQueryNormalizationService normalizationService = mock(ShoeQueryNormalizationService.class);
        Runner runner = runner();
        ShoeMetadataDto payload = new ShoeMetadataDto("Nike", "Pegasus 41", "Volt", null);
        when(authService.findByAuthorizationHeader("Bearer runner-token")).thenReturn(Optional.of(runner));
        when(normalizationService.normalize("Nike Pegasus 41")).thenReturn(payload);
        ShoeQueryNormalizationController controller = controller(authService, normalizationService);

        ResponseEntity<?> response = controller.normalize(
                "Bearer runner-token",
                Map.of("rawInput", "  Nike Pegasus 41  ")
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(payload);
        verify(normalizationService).normalize("Nike Pegasus 41");
    }

    private ShoeQueryNormalizationController controller(
            AuthService authService,
            ShoeQueryNormalizationService normalizationService
    ) {
        return new ShoeQueryNormalizationController(authService, normalizationService);
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(42L);
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    @SuppressWarnings("unchecked")
    private void assertError(ResponseEntity<?> response, HttpStatus expectedStatus, String expectedMessage) {
        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        assertThat((Map<String, String>) response.getBody()).containsEntry("error", expectedMessage);
    }
}
